/* Views: Provider Connect (simulated), Data Sources, Coverage & Economics. Then boot. */
(function () {
  'use strict';
  var HL = window.HL, h = HL.h;

  // ================================================================== PROVIDER CONNECT
  var LIMITS = [
    'Patient-generated data from consumer devices. Estimated measures (cardio fitness, sleep, walking speed) can be off for an individual.',
    'Not continuous monitoring. Nobody reviews this between visits unless a service explicitly says so.',
    'Medians and ranges summarize the period; single readings are not shown and should not be over-read.',
    'Associations only: nothing here shows that any activity caused a change.',
    'No diagnosis, prediction or medication advice was generated.'
  ];

  HL.views.provider = function (root, d) {
    var pid = d.profile.id;
    if (!HL.state.pv || HL.state.pv.pid !== pid) {
      var want = {}; d.profile.goals.forEach(function (g) { (HL.meta.goals[g].measures || []).forEach(function (m) { want[m[0]] = 1; }); });
      HL.state.pv = { pid: pid, metrics: Object.keys(d.provider).filter(function (c) { return want[c]; }), range: '90',
        objective: d.profile.goals[0], exclEntries: true, exclMeds: false, exclConditions: false,
        consent: null, revoked: null, audit: [], showFhir: false };
    }
    var S = HL.state.pv, redraw = function () { root.innerHTML = ''; HL.views.provider(root, d); };
    HL.vhead(root, 'Provider Connect', 'What would I share with my clinician, and what would they actually receive?', null);
    root.appendChild(h('p', { class: 'banner', role: 'note', html: '<span class="illus">Simulated</span><span><strong>No clinic is connected.</strong> Nothing is transmitted, reviewed or monitored. This shows how sharing, revocation and the clinician’s view would work, using the synthetic person’s data.</span>' }));
    root.appendChild(h('div', { style: 'height:14px' }));
    var grid = h('div', { class: 'grid g-side' });

    // form
    var form = h('div', { class: 'steps' });
    form.appendChild(h('fieldset', null, [h('legend', { text: '1 · Your objective for the visit' }),
      h('select', { 'aria-label': 'Objective', onchange: function (e) { S.objective = e.target.value; redraw(); } },
        d.profile.goals.concat(['general']).map(function (g) { return h('option', { value: g, selected: S.objective === g, text: g === 'general' ? 'General check-in' : HL.meta.goals[g].label }); }))]));
    form.appendChild(h('fieldset', null, [h('legend', { text: '2 · Measurements to include' }), h('div', { class: 'checks' }, Object.keys(d.provider).map(function (c) {
      return h('label', null, [h('input', { type: 'checkbox', checked: S.metrics.indexOf(c) >= 0, onchange: function (e) { if (e.target.checked) S.metrics.push(c); else S.metrics = S.metrics.filter(function (x) { return x !== c; }); redraw(); } }), h('span', { text: d.provider[c].label })]);
    }))]));
    form.appendChild(h('fieldset', null, [h('legend', { text: '3 · Period' }), HL.seg([['90', '90 days'], ['180', '180 days'], ['365', '1 year']], S.range, function (v) { S.range = v; redraw(); }, 'Period')]));
    form.appendChild(h('fieldset', null, [h('legend', { text: '4 · Leave out' }), h('div', { class: 'checks' }, [
      chk('Things I typed in (symptoms, notes)', 'exclEntries'), chk('Medication list', 'exclMeds'), chk('Diagnoses', 'exclConditions')])]));
    function chk(label, key) { return h('label', null, [h('input', { type: 'checkbox', checked: S[key], onchange: function (e) { S[key] = e.target.checked; redraw(); } }), h('span', { text: label })]); }
    var now = function () { return new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'; };
    form.appendChild(h('fieldset', null, [h('legend', { text: '5 · Share (simulated)' }),
      h('p', { class: 'note', text: 'Recipient: Synthetic Clinic, primary care (fictional). Access ends automatically after 30 days.' }),
      h('div', { class: 'btns' }, [
        h('button', { type: 'button', class: 'btn', disabled: S.consent && !S.revoked ? true : null, onclick: function () { S.consent = now(); S.revoked = null; S.audit.push(S.consent + ' · You granted Synthetic Clinic access to ' + S.metrics.length + ' measures, ' + S.range + ' days, for 30 days'); S.audit.push(now() + ' · Summary delivered to the clinic inbox (simulated)'); redraw(); }, text: 'Grant access' }),
        h('button', { type: 'button', class: 'btn ghost', disabled: !S.consent || S.revoked ? true : null, onclick: function () { S.revoked = now(); S.audit.push(S.revoked + ' · You revoked access. New data will not be shared.'); redraw(); }, text: 'Revoke access' })]),
      S.audit.length ? h('ol', { class: 'audit', 'aria-label': 'Audit log' }, S.audit.map(function (a) { return h('li', { text: a }); })) : null]));
    grid.appendChild(HL.card('Build the summary', 'You choose what leaves, for how long, and for whom.', [form]));

    // provider view
    var pv = h('div');
    if (!S.consent) pv.appendChild(h('p', { text: 'Nothing received. The clinic sees nothing until you share.' }));
    else if (S.revoked) pv.appendChild(h('div', null, [h('p', { html: '<strong>Access revoked</strong> ' + HL.esc(S.revoked) + '.' }),
      h('p', { class: 'note', text: 'Revocation stops future sharing. A summary the clinic already filed in your medical record stays there under the clinic’s own rules (HIPAA applies to the clinic); ask them if you want it amended.' })]));
    else pv.appendChild(h('div', null, [h('p', { html: '<strong>Received</strong> ' + HL.esc(S.consent) + ' · ' + S.metrics.length + ' measures · patient-generated' }),
      h('p', { class: 'warnbox', style: 'border:1px solid var(--warn);padding:8px 10px;border-radius:8px', text: 'Not monitored. This summary will be read at the visit, not in real time.' }),
      h('p', { class: 'note', text: 'The clinic sees the one-page summary below, labelled as patient-generated, with sources and limits. It does not see raw streams, other measures, or anything you left out.' })]));
    grid.appendChild(HL.card('The clinician’s side (synthetic)', null, [pv]));
    root.appendChild(grid);
    root.appendChild(h('div', { style: 'height:16px' }));

    // the report
    var rep = report(d, S);
    var wrap = h('div', { class: 'print-target' }, [
      h('div', { class: 'btns noprint', style: 'margin-bottom:10px' }, [
        h('button', { type: 'button', class: 'btn', onclick: function () { document.body.classList.add('printing-report'); window.print(); setTimeout(function () { document.body.classList.remove('printing-report'); }, 500); }, text: 'Print or save as PDF' }),
        h('button', { type: 'button', class: 'btn ghost', 'aria-expanded': String(S.showFhir), onclick: function () { S.showFhir = !S.showFhir; redraw(); }, text: (S.showFhir ? 'Hide' : 'Preview') + ' FHIR payload' }),
        h('button', { type: 'button', class: 'btn ghost', onclick: function () { HL.download('health-summary-' + pid + '-synthetic.fhir.json', JSON.stringify(fhir(d, S), null, 2), 'application/fhir+json'); }, text: 'Download FHIR JSON' })]),
      rep]);
    root.appendChild(wrap);
    if (S.showFhir) {
      root.appendChild(h('div', { style: 'height:12px' }));
      root.appendChild(HL.card('FHIR R4 payload (preview)', 'Simplified, not validated against a profile. A real integration would use the clinic’s SMART on FHIR app or a document the EHR accepts. Tag <code>patient-generated</code> travels with every resource.', [h('pre', { class: 'code', tabindex: '0', text: JSON.stringify(fhir(d, S), null, 2) })]));
    }
  };

  function report(d, S) {
    var r = S.range, rows = [], labs = [];
    S.metrics.forEach(function (c) {
      var e = d.provider[c]; if (!e) return;
      if (e.labs) { e.labs.forEach(function (x) { labs.push([e.label, HL.date(x.date), HL.fmt(x.value, c), x.orig, (x.flags || []).join('; ')]); }); return; }
      var x = e.ranges[r]; if (!x) return;
      rows.push([e.label, HL.fmt(x.median, c), HL.num(x.p10, c) + '–' + HL.num(x.p90, c), String(x.n) + (x.coverage != null ? ' (' + Math.round(x.coverage * 100) + '%)' : ''), x.status ? HL.STATUS[x.status] : '—', HL.kindLabel[e.kind] + ' · ' + e.sources.join(', ')]);
    });
    var sig = d.signals.filter(function (s) { return (s.tier === 'discuss' || s.tier === 'context') && (S.metrics.indexOf(s.metric) >= 0 || s.metric === 'record'); });
    var obj = S.objective === 'general' ? 'General check-in' : HL.meta.goals[S.objective].label;
    var qs = S.objective === 'general' ? [] : HL.meta.goals[S.objective].questions;
    var clin = d.clinical.filter(function (c) { return (c.type === 'condition' && !S.exclConditions) || (c.type === 'medication' && !S.exclMeds) || c.type === 'clinical_goal' || c.type === 'care_plan'; });
    return h('article', { class: 'report', 'aria-label': 'Clinician summary' }, [
      h('h3', { text: 'Patient-generated health summary · ' + d.profile.name + ' (synthetic)' }),
      h('p', { text: 'Period: last ' + r + ' days to ' + HL.date(d.as_of) + '. Prepared by the patient with the PaddySpeaks Health Intelligence Lab (demonstration). Fictional data.' }),
      h('div', { class: 'warnbox', text: 'Not continuous monitoring. Not reviewed by anyone unless your clinic says so. No diagnosis or medication advice was generated.' }),
      h('h4', { text: '1 · Patient’s objective' }), h('p', { text: obj }),
      clin.length ? h('p', { text: 'On record: ' + clin.map(function (c) { return c.text + (c.conflict ? ' [patient reports ' + c.conflict.reported_status + ' on ' + c.conflict.reported_on + ']' : ''); }).join(' · ') }) : null,
      h('h4', { text: '2 · Relevant measurements and trend' }),
      rows.length ? HL.table(['Measure', 'Median', '10th–90th', 'Days or readings (coverage)', 'Against previous ' + r + ' days', 'Source and kind'], rows, 'Measurements') : h('p', { text: 'No measurements selected.' }),
      labs.length ? HL.table(['Lab', 'Date', 'Result', 'As reported', 'Notes'], labs, 'Laboratory results') : null,
      h('h4', { text: '3 · Source and quality' }),
      h('ul', { class: 'plain' }, d.sources.map(function (s) { return h('li', { text: s.name + ' (' + s.file + '): ' + s.kept + ' records kept, ' + s.duplicates + ' duplicates removed, ' + s.rejected + ' rejected' + (s.last ? ', last ' + HL.date(s.last) : '') }); })
        .concat(d.notes.map(function (n) { return h('li', { text: n.detail }); }))),
      h('h4', { text: '4 · Open questions' }),
      h('ul', { class: 'plain' }, sig.map(function (s) { return h('li', { text: s.why }); }).concat(qs.map(function (q) { return h('li', { text: q }); }))
        .concat(S.exclEntries ? [] : d.entries.filter(function (e) { return e.type === 'symptom'; }).map(function (e) { return h('li', { text: 'Patient noted (' + e.date + '): ' + e.text }); }))),
      h('h4', { text: '5 · Important limitations' }),
      h('ul', { class: 'plain' }, LIMITS.map(function (l) { return h('li', { text: l }); }))
    ]);
  }

  function fhir(d, S) {
    var tag = { system: 'https://paddyspeaks.com/fhir/tags', code: 'patient-generated', display: 'Patient-generated, consumer device (synthetic demo)' };
    var pref = 'Patient/synthetic-' + d.profile.id, entries = [{ resource: { resourceType: 'Patient', id: 'synthetic-' + d.profile.id, meta: { tag: [tag] }, name: [{ text: d.profile.name + ' (synthetic)' }] } }];
    var ids = [];
    S.metrics.forEach(function (c) {
      var e = d.provider[c]; if (!e) return;
      var code = e.loinc ? { coding: [{ system: 'http://loinc.org', code: e.loinc, display: e.label }], text: e.label } : { text: e.label };
      if (e.labs) {
        e.labs.forEach(function (x, i) {
          var id = c + '-' + i; ids.push('Observation/' + id);
          entries.push({ resource: { resourceType: 'Observation', id: id, status: 'final', meta: { tag: [{ system: tag.system, code: 'clinician-verified-import' }] }, code: code, subject: { reference: pref }, effectiveDateTime: x.date, valueQuantity: { value: x.value, unit: e.unit } } });
        });
        return;
      }
      var x = e.ranges[S.range]; if (!x) return;
      var id = c + '-summary-' + S.range; ids.push('Observation/' + id);
      entries.push({ resource: { resourceType: 'Observation', id: id, status: 'final', meta: { tag: [tag] }, code: code, subject: { reference: pref },
        effectivePeriod: { start: x.from, end: x.to }, valueQuantity: { value: x.median, unit: e.unit }, method: { text: 'Median of ' + x.n + ' daily values or readings' },
        note: [{ text: '10th–90th percentile ' + x.p10 + '–' + x.p90 + ' ' + e.unit + '. ' + HL.kindLabel[e.kind] + '. Source: ' + e.sources.join(', ') + '.' + (x.status ? ' Against previous period: ' + HL.STATUS[x.status] + '.' : '') }] } });
    });
    entries.push({ resource: { resourceType: 'Provenance', target: ids.map(function (r) { return { reference: r }; }), recorded: d.as_of + 'T16:00:00Z',
      agent: [{ type: { text: 'author' }, who: { reference: pref } }], entity: [{ role: 'source', what: { display: 'PaddySpeaks Health Intelligence Lab (demonstration), from patient-authorized imports' } }] } });
    entries.push({ resource: { resourceType: 'Consent', status: S.consent && !S.revoked ? 'active' : 'inactive', scope: { text: 'patient-privacy' }, category: [{ text: 'Share selected summary with a care team' }],
      patient: { reference: pref }, performer: [{ reference: pref }], organization: [{ display: 'Synthetic Clinic, primary care' }],
      provision: { type: 'permit', period: { start: d.as_of, end: '(30 days from grant)' }, data: ids.map(function (r) { return { meaning: 'instance', reference: { reference: r } }; }) } } });
    return { resourceType: 'Bundle', type: 'collection', meta: { tag: [tag] }, entry: entries };
  }

  // ================================================================== DATA SOURCES
  HL.views.sources = function (root, d) {
    HL.vhead(root, 'Data Sources', 'Where did each number come from, how fresh is it, and what was done to it?', null);
    root.appendChild(HL.card('How data gets in', null, [h('div', { class: 'grid g2' }, [
      h('div', null, [h('p', { html: '<strong>Apple Health.</strong> A website cannot read the Health database on an iPhone; HealthKit is only available to apps on the device with your permission. Two honest routes: the Health app’s <em>Export All Health Data</em> (a ZIP holding <code>export.xml</code>, which this lab’s adapter parses), or a companion iOS app that reads HealthKit with permission and syncs what you allow.' }),
        h('p', { html: '<strong>Devices.</strong> Cuffs, scales and glucose sensors arrive through the device maker’s export or API, or through Apple Health. Not every device has a public API; the adapter reads what the maker documents.' })]),
      h('div', null, [h('p', { html: '<strong>Clinical records.</strong> Patient-authorized FHIR R4 (labs, conditions, medications, goals), the format US certified health IT exposes to patient apps. Structured data first; a PDF would need extraction with human review and visible uncertainty.' }),
        h('p', { html: '<strong>Your own entries.</strong> Goals, symptoms, reported medicines and history are labelled <span class="kind patient_reported">You entered</span> and never become a confirmed diagnosis or an active prescription.' })])])]));
    root.appendChild(h('div', { style: 'height:16px' }));
    root.appendChild(HL.card('Sources for ' + d.profile.name, 'Every file this person “imported”, as the pipeline saw it. Freshness is days since the last record, as of ' + HL.date(d.as_of) + '.', [
      HL.table(['File', 'Source', 'Measures', 'First – last', 'Freshness', 'Kept', 'Duplicates', 'Rejected', 'Skipped'], d.sources.map(function (s) {
        return [s.file, s.name, s.measures.join(', ') || '—', s.first ? HL.date(s.first) + ' – ' + HL.date(s.last) : '—', s.fresh_days == null ? '—' : s.fresh_days + ' d', s.kept, s.duplicates, s.rejected, s.skipped];
      }), 'Sources'),
      h('div', { class: 'grid', style: 'margin-top:12px' }, d.sources.map(function (s) {
        return h('details', { class: 'alt' }, [h('summary', { text: s.file + ' — what the file looks like and what happened to it' }),
          h('pre', { class: 'code', tabindex: '0', text: s.sample || '(no sample)' }),
          s.log.length ? HL.table(['Outcome', 'Reason', 'Count'], s.log.map(function (l) { return [l.outcome, l.reason || '—', l.count]; }), 'Import log for ' + s.file) : null]);
      }))]));
    root.appendChild(h('div', { style: 'height:16px' }));
    var grid = h('div', { class: 'grid g2' });
    grid.appendChild(HL.card('What the importer caught', null, [h('ul', { class: 'plain' }, d.notes.map(function (n) { return h('li', null, [h('strong', { text: n.what + ': ' }), n.detail]); })
      .concat([h('li', { text: 'Time zones seen: ' + d.timezones.join(', ') + (d.away_days.length ? '. ' + d.away_days.length + ' days recorded away from home (' + HL.date(d.away_days[0]) + ' – ' + HL.date(d.away_days[d.away_days.length - 1]) + '); each reading keeps its own offset and counts on the local day as lived.' : '.') })]))]));
    var pick = h('select', { 'aria-label': 'Choose a record', style: 'max-width:100%;margin-bottom:8px' }, d.provenance.map(function (o, i) { return h('option', { value: i, text: HL.label(o.code) + ' · ' + o.local_date + ' · ' + o.source.name + (o.flags.length ? ' · ' + o.flags[0] : '') }); }));
    var pre = h('pre', { class: 'code', tabindex: '0', text: JSON.stringify(d.provenance[0], null, 2) });
    pick.addEventListener('change', function () { pre.textContent = JSON.stringify(d.provenance[+pick.value], null, 2); });
    grid.appendChild(HL.card('A canonical record, in full', 'Pick a record. Every observation keeps the original value and unit, the standard unit, the offset it was recorded in, its source and device, how it was made, the import time, the consent scope and any quality flags.', [pick, pre]));
    root.appendChild(grid);
  };

  // ================================================================== ECONOMICS
  var MODELS = [
    ['Device incentives', 'A subsidized watch or cuff, sometimes earned back through activity.', 'Life insurers and some employers. Example: John Hancock Vitality (a life insurer) offers Apple Watch with installments reduced by activity.', 'Life insurers are generally not HIPAA covered entities; state insurance law applies.', 'Rewards people who were already active.'],
    ['Wellness rewards', 'Points or premium discounts for participation or targets.', 'Employer group health plans.', 'HIPAA wellness rules cap health-contingent rewards at 30% of coverage cost (50% for tobacco) and require a reasonable alternative.', 'Two randomized workplace-wellness trials found no significant effect on measured health or spending.'],
    ['Coaching subscriptions', 'A consumer pays for guidance and programs.', 'The individual.', 'Consumer privacy law (FTC Health Breach Notification Rule; state laws such as Washington’s My Health My Data Act).', 'Charging people to understand data they already own erodes trust.'],
    ['Chronic-condition programs', 'A plan pays for a defined program (prediabetes, hypertension).', 'Health plans; Medicare (the Medicare Diabetes Prevention Program for eligible people).', 'Program-specific eligibility and documentation.', 'The Diabetes Prevention Program trial showed clinical effects; a watch-based program does not inherit them.'],
    ['Clinician-directed remote monitoring', 'A clinician orders monitoring for a condition and bills for it.', 'Medicare and many plans.', 'Requires an FDA-defined medical device, automatic data transmission, an established relationship and medical necessity. Wellness data does not automatically qualify.', 'Workload without review time; data nobody reads.'],
    ['Value-based care pilots', 'Providers are paid for outcomes, so prevention tools are a cost of doing the job.', 'Accountable care organizations; CMS models such as ACCESS (voluntary, from July 2026).', 'Model-specific.', 'Selection: enrolling the people easiest to improve.']
  ];
  var EVID = [
    ['Song & Baicker, JAMA, 2019', 'Workplace wellness program (BJ’s Wholesale), randomized: some self-reported behaviors improved; no significant effects on clinical markers, spending or utilization at 18 months.'],
    ['Reif et al., JAMA Internal Medicine, 2020', 'Illinois Workplace Wellness Study, randomized: no significant effects on measured health or medical spending over 30 months.'],
    ['Knowler et al., NEJM, 2002', 'Diabetes Prevention Program: the lifestyle intervention reduced diabetes incidence by 58% versus placebo in people at high risk. A clinical effect, not a savings figure; a watch was not part of it.'],
    ['Tucker et al., PLoS Medicine, 2017', 'Self-monitoring of blood pressure lowers blood pressure when combined with other support; alone, effects are small.']
  ];
  HL.state.econ = null;

  HL.views.economics = function (root, d) {
    var E = HL.econ;
    if (!HL.state.econ) { HL.state.econ = {}; for (var k in E.DEFAULTS) HL.state.econ[k] = E.DEFAULTS[k]; }
    var X = HL.state.econ;
    HL.vhead(root, 'Coverage & Economics', 'Who could pay for prevention, under what rules, and when would it pay off?', null);
    root.appendChild(h('p', { class: 'lede', text: 'Prevention can be worth paying for because people live better, even when it does not save money. Whether it saves money is a question for a trial. This page never assumes savings: the utilization change starts at zero and is always your hypothesis.' }));
    root.appendChild(HL.card('Six business models', '<span class="lbl pub">Published evidence</span> and rules as reported; check current program terms.', [
      HL.table(['Model', 'How it works', 'Who pays · example', 'Rules', 'Evidence or main risk'], MODELS.map(function (m) { return m; }), 'Business models')]));
    root.appendChild(h('div', { style: 'height:16px' }));

    var out = h('div');
    var inputs = [
      ['eligible', 'Eligible population', 'ass'], ['enrollPct', 'Enrollment (%)', 'ass'], ['programCost', 'Program cost per participant per year ($)', 'ass'],
      ['deviceSubsidy', 'Device subsidy, one-time ($)', 'ass'], ['coaching', 'Coaching per participant per year ($)', 'ass'], ['clinicianReview', 'Clinician review per participant per year ($)', 'ass'],
      ['techFixed', 'Technology, security and support per year ($)', 'ass'], ['baselineSpend', 'Participants’ medical spending per year before the program ($)', 'ass'],
      ['utilChangePct', 'Change in that spending (%) — negative means lower', 'hyp'], ['years', 'Evaluation period (years)', 'ass']];
    var form = h('div', { class: 'inputs' }, inputs.map(function (f) {
      return h('label', null, [h('span', { html: HL.esc(f[1]) + ' <span class="lbl ' + f[2] + '">' + (f[2] === 'hyp' ? 'Hypothetical' : 'Your assumption') + '</span>' }),
        h('input', { type: 'number', value: X[f[0]], step: 'any', oninput: function (e) { var v = parseFloat(e.target.value); if (!isNaN(v)) { X[f[0]] = v; draw(); } } })]);
    }));
    var $ = function (v) { return v == null ? '—' : (v < 0 ? '−$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-US'); };
    function draw() {
      var r = E.program(X); out.innerHTML = '';
      var lines = r.lines;
      out.appendChild(h('div', { class: 'grid g3' }, [
        h('div', null, [h('p', { class: 'note', html: 'Total program cost <span class="lbl calc">Calculated</span>' }), h('p', { class: 'big', text: $(r.totalCost) })]),
        h('div', null, [h('p', { class: 'note', html: 'Change in medical spending <span class="lbl hyp">Hypothetical</span>' }), h('p', { class: 'big', text: $(r.spendingChange) })]),
        h('div', null, [h('p', { class: 'note', html: 'Net cost (cost + spending change) <span class="lbl calc">Calculated</span>' }), h('p', { class: 'big', text: $(r.net) })])]));
      out.appendChild(h('dl', { class: 'kv', style: 'margin-top:12px' }, [
        h('dt', { text: 'Participants' }), h('dd', { text: r.participants.toLocaleString() }),
        h('dt', { text: 'Program fees' }), h('dd', { text: $(lines.program) }), h('dt', { text: 'Devices' }), h('dd', { text: $(lines.devices) }),
        h('dt', { text: 'Coaching' }), h('dd', { text: $(lines.coaching) }), h('dt', { text: 'Clinician review' }), h('dd', { text: $(lines.review) }),
        h('dt', { text: 'Technology' }), h('dd', { text: $(lines.technology) }),
        h('dt', { text: 'Cost per participant per year' }), h('dd', { text: $(r.costPerParticipantYear) }),
        h('dt', { html: '<strong>Break-even:</strong> participants’ spending would have to fall by' }), h('dd', null, [h('strong', { text: r.breakEvenReductionPct == null ? '—' : r.breakEvenReductionPct.toFixed(1) + '%' })])]));
      out.appendChild(h('p', { class: 'note', text: r.breakEvenReductionPct != null ? 'For comparison: the two randomized workplace-wellness trials below found no significant change in spending. A program can still be worth funding for health reasons; it just should not be sold as paying for itself without evidence.' : '' }));
      var sens = E.sensitivity(X);
      out.appendChild(h('h3', { style: 'margin:16px 0 6px;font-size:15px', text: 'Sensitivity: net cost by enrollment and assumed spending change' }));
      out.appendChild(h('div', { class: 'tblwrap', tabindex: '0', role: 'region', 'aria-label': 'Sensitivity table' }, [h('table', { class: 'heat' }, [
        h('thead', null, [h('tr', null, [h('th', { scope: 'col', text: 'Enrollment' })].concat(sens[0].cells.map(function (c) { return h('th', { scope: 'col', text: (c.utilChangePct > 0 ? '+' : '') + c.utilChangePct + '% spending' }); })))]),
        h('tbody', null, sens.map(function (row) { return h('tr', null, [h('th', { scope: 'row', text: row.enrollPct + '%' })].concat(row.cells.map(function (c) {
          return h('td', { class: c.net < 0 ? 'pos' : 'neg', text: c.net < 0 ? 'saves ' + $(-c.net) : 'costs ' + $(c.net) });
        }))); }))])]));
      out.appendChild(h('p', { class: 'note', text: '“Saves” appears only where you assume spending falls by more than the program costs. Every cell is arithmetic on assumptions, not a forecast.' }));
    }
    var grid = h('div', { class: 'grid g-side' });
    grid.appendChild(HL.card('Program simulator', 'Defaults are round placeholders, not real program figures. Replace them with your own.', [form, h('div', { style: 'height:14px' }), out]));
    grid.appendChild(HL.card('Before you believe any business case', null, [
      h('ul', { class: 'plain' }, [
        'Selection bias: people who enroll are often healthier or more motivated; compare against a randomized or matched group.',
        'Prevention can increase spending: more screening finds more to treat, and that can be good for health.',
        'Payer incentives: a plan that loses members in two years has little reason to fund a ten-year benefit.',
        'Reimbursement rules decide what is billable, not what is useful (remote monitoring needs an FDA-defined device and medical necessity).',
        'Outcomes first: validated clinical measures, then experience, utilization and total cost of care.',
        'Never the revenue model: selling patient-level data, or using data shared for care to price insurance.'
      ].map(function (t) { return h('li', { text: t }); })),
      h('h3', { style: 'margin:14px 0 6px', text: 'Published evidence' }),
      h('ul', { class: 'plain' }, EVID.map(function (e) { return h('li', null, [h('span', { class: 'lbl pub', text: 'Published' }), ' ', h('strong', { text: e[0] + '. ' }), e[1]]); }))]));
    root.appendChild(grid);
    draw();
  };

  HL.boot();
})();
