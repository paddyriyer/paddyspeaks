/* Every Arrow Is a Decision — the essay's models.
 *
 * Pure functions: no DOM. figures.js calls them in the browser and
 * scripts/every_arrow/build.mjs calls them to write the static fallbacks, so
 * a number on the interactive figure and the same number in print cannot
 * disagree. Where a model is a simplification, the essay labels it so.
 */
(function (root) {
  'use strict';
  var M = {};
  function days(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

  /* ── time formatting ─────────────────────────────────────────── */
  M.fmtSecs = function (s) {
    if (s == null) return 'never';
    if (s < 60) return Math.round(s) + 's';
    if (s < 3600) return Math.round(s / 60) + 'm';
    if (s < 86400) return (s / 3600).toFixed(s < 36000 ? 1 : 0) + 'h';
    return (s / 86400).toFixed(1) + 'd';
  };
  M.n = function (v) { return typeof v === 'number' ? v.toLocaleString('en-US') : v; };
  M.big = function (v) {
    if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1e3) return Math.round(v / 1e3) + 'k';
    return String(v);
  };

  /* ── 01 · which inferences survive a join policy ────────────────── */
  M.person = function (P, mode) {
    return P.inf.map(function (f) {
      var crossScope = f.needs.length > 1;
      var on = mode === 'join' ? true : mode === 'scoped' ? !crossScope || f.v === 'Likely pregnant' : !crossScope && !f.sensitive;
      /* "Likely pregnant" comes from one product's own basket history, so scoping
         identifiers does not stop it; only a sensitive-inference guard does. */
      if (mode === 'guarded' && f.sensitive) on = false;
      return { v: f.v, src: f.src, on: on, why: on ? (mode === 'join' ? 'joinable' : 'computed inside one purpose') : (f.sensitive && mode === 'guarded' ? 'sensitive inference blocked' : 'needs a cross-purpose join') };
    });
  };

  /* ── 02 · synthetic crowd (seeded, deterministic) ───────────────── */
  M.crowd = function () {
    var seed = 20000611;
    function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    var P = [];
    for (var i = 0; i < 1000; i++) P.push({ zip: Math.floor(rnd() * 3), sex: Math.floor(rnd() * 2), year: Math.floor(rnd() * 56), day: Math.floor(rnd() * 365) });
    var TI = 613, T = P[TI];
    P.forEach(function (p, i) { if (i !== TI && p.zip === T.zip && p.sex === T.sex && p.year === T.year && p.day === T.day) p.day = (p.day + 1) % 365; });
    return { people: P, target: TI };
  };
  M.crowdMatch = function (C, on) {
    var T = C.people[C.target];
    return C.people.filter(function (p) { return ['zip', 'sex', 'year', 'day'].every(function (k) { return !on[k] || p[k] === T[k]; }); }).length;
  };

  /* ── 04 · when the data is wrong ────────────────────────────────── */
  M.wrong = function (W, useId, guards) {
    var u = W.uses.filter(function (x) { return x.id === useId; })[0] || W.uses[0];
    var met = u.need.filter(function (g) { return guards[g]; });
    var missing = u.need.filter(function (g) { return !guards[g]; });
    /* Residual: severity reduced by the share of required safeguards in place;
       any missing safeguard on a severe use keeps it at least High. */
    var share = u.need.length ? met.length / u.need.length : 1;
    var residual = u.sev === 1 ? 1 : Math.max(1, Math.round(u.sev * (1 - 0.75 * share)));
    if (missing.length && u.sev >= 3) residual = Math.max(residual, 2);
    return { use: u, met: met, missing: missing, residual: residual };
  };

  /* ── 12 · consent propagation from Northstar's consumers ────────── */
  /* Latency per consumer is lognormal around its p50, with spread set by its
     p95; a consumer with no latency at all never receives the revocation. */
  M.consent = function (NS, fixNever) {
    var ref = NS.consentConsumers.filter(function (c) { return c.id === 'cc3'; })[0];
    var rows = NS.consentConsumers.map(function (c) {
      var never = c.p50 == null;
      if (never && fixNever) return { name: c.name, mode: 'read-time (fixed)', p50: ref.p50, p95: ref.p95, p99: ref.p99, never: false, fixed: true };
      return { name: c.name, mode: c.mode, p50: c.p50, p95: c.p95, p99: c.p99, never: never, stale: c.stale };
    });
    var never = rows.filter(function (r) { return r.never; });
    var sd = 42;
    function r() { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }
    function gauss() { var u = r() || 1e-9, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var out = [];
    for (var i = 0; i < 2000; i++) {
      var mx = 0;
      rows.forEach(function (c) {
        if (c.never) return;
        var sig = c.p95 > c.p50 ? Math.log(c.p95 / c.p50) / 1.645 : 0.05;
        var x = c.p50 * Math.exp(sig * gauss());
        if (x > mx) mx = x;
      });
      out.push(mx);
    }
    out.sort(function (a, b) { return a - b; });
    function q(p) { return out[Math.min(out.length - 1, Math.floor(p * out.length))]; }
    var stale = never.reduce(function (s, x) { return s + (x.stale || 0); }, 0);
    return { rows: rows, never: never.length, stale: stale, p50: never.length ? null : q(0.5), p95: never.length ? null : q(0.95), p99: never.length ? null : q(0.99), sim: { p50: q(0.5), p95: q(0.95), p99: q(0.99) } };
  };

  /* ── 22 · privacy SLOs from Northstar's data ───────────────────── */
  M.slos = function (NS) {
    var today = NS.TODAY;
    var con = M.consent(NS, false);
    var checked = NS.consentConsumers.filter(function (c) { return c.p99 != null; });
    var worst = checked.reduce(function (a, c) { return c.p99 > a.p99 ? c : a; }, checked[0]);
    var dt = NS.deletionTargets, ver = dt.filter(function (t) { return t[3] === 'verified'; }).length;
    var viol = NS.datasets.filter(function (x) { var r = x.retention; return r && r.required > 0 && r.actual > r.required; });
    var mism = NS.accessEvents.filter(function (a) { return a.flag === 'purpose mismatch'; });
    var stale = NS.datasets.filter(function (x) { return !x.lastAudit || days(x.lastAudit, today) > 365; });
    var vend = NS.vendors.filter(function (v) { return !v.infraOnly; });
    var att = vend.filter(function (v) { return v.attestation && days(v.attestation, today) <= 365; });
    var ch = { working: 0, failing: 0, unknown: 0 };
    NS.controls.forEach(function (c) { ch[c.health] = (ch[c.health] || 0) + 1; });
    return [
      { id: 'consent', t: 'Consent latency', v: con.never ? 'never · ' + con.never : M.fmtSecs(worst.p99), unit: con.never ? 'consumers never hear a revocation' : 'P99, slowest consumer',
        target: 'Every consumer honours a revocation within 24 h (P99)', status: con.never || worst.p99 > 86400 ? 'breach' : 'ok',
        rule: 'Slowest consumer P99 across the ' + NS.consentConsumers.length + ' consumers; a consumer with no check has no latency — it never hears.', detail: 'Slowest that does check: ' + worst.name + ' at ' + M.fmtSecs(worst.p99) + '.', route: 'privacy/consent' },
      { id: 'delete', t: 'Deletion completion', v: ver + ' / ' + dt.length, unit: 'systems verified', target: 'All systems verified within 30 days of the request', status: ver === dt.length ? 'ok' : 'breach',
        rule: 'Deletion targets whose last Forget-Me run was verified by a canary re-query.', detail: dt.length - ver + ' not verified: failed, waiting on a vendor, or unknown.', route: 'privacy/deletion' },
      { id: 'retention', t: 'Retention violations', v: String(viol.length), unit: 'datasets older than declared', target: '0', status: viol.length ? 'breach' : 'ok',
        rule: 'Datasets whose oldest record is older than the retention they declare.', detail: viol.map(function (x) { return x.name; }).slice(0, 3).join(', ') + (viol.length > 3 ? ' …' : ''), route: 'privacy/retention' },
      { id: 'purpose', t: 'Purpose-mismatched reads allowed', v: String(mism.length), unit: 'caught after the fact', target: '0 — denied at read, not found later', status: mism.length ? 'breach' : 'ok',
        rule: 'Access events flagged “purpose mismatch” by the audit scan (a runtime purpose check would have denied them).', detail: mism.map(function (a) { return a.who + ' → ' + a.what; }).join('; '), route: 'privacy/purpose' },
      { id: 'evidence', t: 'Evidence freshness', v: (NS.datasets.length - stale.length) + ' / ' + NS.datasets.length, unit: 'datasets audited in the last year', target: 'All personal datasets audited within 365 days', status: stale.length ? 'breach' : 'ok',
        rule: 'Datasets with a last audit on record within 365 days of ' + today + '.', detail: stale.length + ' with no audit, or an audit older than a year.', route: 'assurance/controls' },
      { id: 'vendor', t: 'Vendor acknowledgements', v: att.length + ' / ' + vend.length, unit: 'vendors attested this year', target: 'Every vendor attests deletion and retention yearly', status: att.length === vend.length ? 'ok' : 'breach',
        rule: 'Vendors (infrastructure excluded) with a deletion/retention attestation within 365 days.', detail: vend.length - att.length + ' without a current attestation.', route: 'governance/vendors' },
      { id: 'controls', t: 'Control health', v: ch.working + ' / ' + NS.controls.length, unit: 'controls working', target: 'Failing and unknown controls each have an owner and a date', status: ch.failing || ch.unknown ? 'breach' : 'ok',
        rule: 'Controls by last observed health: working, failing, unknown. Unknown is a finding.', detail: ch.failing + ' failing · ' + ch.unknown + ' unknown.', route: 'assurance/controls' }
    ];
  };
  M.observe = function (D, NS, picked) {
    var inc = NS.incidents;
    var caught = {};
    D.monitors.forEach(function (m) { if (picked[m.id]) m.catches.forEach(function (c) { caught[c] = m.t; }); });
    return inc.map(function (i) { return { id: i.id, title: i.title, people: i.people, by: caught[i.id] || null }; });
  };

  /* ── 21 · change detection ─────────────────────────────────────── */
  M.change = function (D, k, withContracts) {
    var applied = D.changes.slice(0, k);
    var broken = {}, detected = 0;
    applied.forEach(function (c) {
      /* With contracts, a detected change is blocked at deploy, so it breaks nothing. */
      if (c.breaks >= 0 && !(withContracts && c.rule)) broken[c.breaks] = true;
      if (withContracts && c.rule) detected++;
    });
    var nBroken = Object.keys(broken).length;
    var status = !k ? 'APPROVED' : withContracts ? (detected ? 'REOPENED' : 'APPROVED') : 'APPROVED';
    return { applied: applied, broken: broken, nBroken: nBroken, held: D.verdict.length - nBroken, detected: detected, status: status, stale: !withContracts && nBroken > 0 };
  };

  /* ── 23 · incident response ────────────────────────────────────── */
  /* choices: array of true (the move that holds) / false (the tempting move) /
     undefined (not yet decided), one per step. Simplified model. */
  M.incident = function (D, choices) {
    var c = function (i) { return choices[i] === true; }, b = function (i) { return choices[i] === false; };
    var runDays = (b(0) ? 1 : 0) + (b(1) ? 6 : 0);
    var copies = 0;
    if (b(2)) copies += 1;
    if (b(5)) copies += 3;
    var evidence = b(1) ? 'lost' : b(2) ? 'kept — as a new copy' : c(2) ? 'kept in place' : '—';
    var decided = c(4) ? 'on day 1, with reasons' : b(4) ? 'late' : '—';
    var guarded = c(6);
    var done = choices.filter(function (x) { return x !== undefined; }).length;
    return { runDays: runDays, copies: copies, evidence: evidence, decided: decided, guarded: guarded, done: done, total: D.length };
  };

  /* ── 14 · retention: usefulness halves about every two weeks (tau = 21 days) ── */
  M.retention = function (R) {
    var TAU = 21, MAXD = 730, u = 1 - Math.exp(-R / TAU), rows = R * 2e6;
    return { days: R, u: u > 0.995 ? '>99' : String(Math.round(u * 100)), rows: rows >= 1e9 ? (rows / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B' : Math.round(rows / 1e6) + 'M', x: String(Math.max(1, Math.round(R / MAXD * 100))) };
  };

  /* ── 20 · DP ledger ────────────────────────────────────────────── */
  M.ledger = function (total, spentList, eps) {
    var spent = spentList.reduce(function (s, q) { return s + q; }, 0);
    var rem = total - spent;
    return { ok: eps <= rem + 1e-9, spent: spent, rem: rem };
  };

  root.EA_MODEL = M;
})(typeof window !== 'undefined' ? window : globalThis);
