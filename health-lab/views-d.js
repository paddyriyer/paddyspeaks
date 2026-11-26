/* Lab 3.0 views: Import & Privacy, Can It Be Anonymous?, My Data Rights; plus the
   five-questions strip, coverage panel, coverage heatmap and processing economics
   added to existing views. Facts about Apple are as checked on 26 November 2026 and
   carry their sources; recheck them before relying on them. */
(function () {
  'use strict';
  var HL = window.HL, h = HL.h;

  // ================================================================== IMPORT & PRIVACY
  var FEAS = [
    ['Consumer export', 'The Health app\'s Export All Health Data creates export.zip: export.xml (all samples), export_cda.xml, ECG recordings as CSV files and workout routes as GPX files.', 'Available', 'Apple Health app; widely documented export format'],
    ['HealthKit access through apps', 'HealthKit is an on-device framework for iPhone, Apple Watch and other Apple apps. The person grants read access type by type. There is no web or server API: a website cannot read it.', 'Available (apps only)', 'developer.apple.com/documentation/healthkit'],
    ['Programmatic sync', 'An app can wake on new data (an observer query with the background-delivery entitlement) and fetch only changes (an anchored query). Sending data to the developer\'s own server is the developer\'s design, under App Store rules.', 'Available (apps only)', 'HealthKit: enableBackgroundDelivery; HKAnchoredObjectQuery'],
    ['Health records (FHIR)', 'Health Records brings FHIR records from participating health systems into the Health app; apps can read them read-only with a special clinical-records entitlement.', 'Available (entitlement)', 'HealthKit: Accessing health records'],
    ['Apple coaching or analytics subscription', 'None offered as of November 2026. A reported "Health+" AI coaching service was reportedly scaled back in February 2026, with features to arrive in the Health app over time. Apple Fitness+ is a workout service, not analysis of your data.', 'Not available', 'Bloomberg, 5 Feb 2026 (reported)'],
    ['Paid hosted health-data API (DaaS)', 'No documented Apple service sells or hosts access to a person\'s health data or analysis of it.', 'Not available', 'No such product in Apple\'s developer documentation'],
    ['Enterprise and healthcare partnerships', 'Health Records integrations and Share with Provider (US, participating organizations); research studies through Apple\'s Research app. None is a commercial analytics API for third parties.', 'Partnerships, not an API', 'Apple Health Records; Share with Provider'],
    ['On-device intelligence', 'HealthKit computes on device; Apple\'s Foundation Models framework lets apps run Apple\'s on-device language model. Using either on health data is the developer\'s responsibility under the same rules.', 'Available (apps only)', 'Apple developer documentation']
  ];
  var OPTIONS = [
    // option, cost, completeness, effort, privacy, clinical relevance, portability, maintenance, control
    ['Apple\'s own Health app', 'Included', 'High (Apple data)', 'None', 'High (on device, end-to-end sync)', 'Medium', 'Export only', 'Apple\'s', 'High'],
    ['Health export + local analysis (this lab)', 'Low', 'High at export time; no updates', 'Low', 'High: nothing leaves the device', 'Medium', 'High (files)', 'Low', 'Highest'],
    ['Native HealthKit companion app', 'Medium: app development', 'High, incremental', 'High (iOS, review, entitlements)', 'High if computed on the phone', 'Medium', 'Medium', 'Medium–High', 'High (per-type permissions)'],
    ['Local-browser analytics', 'Low', 'Depends on what you import', 'Low', 'High; device and extensions remain risks', 'Medium', 'High', 'Low', 'High'],
    ['Self-hosted private processing', 'Medium: your server', 'High', 'Medium', 'High if well secured', 'Medium', 'High', 'Your responsibility', 'High'],
    ['Independent commercial analytics service', 'Subscription', 'Varies', 'Low for you', 'Depends on the vendor; often not HIPAA', 'Varies; check validation', 'Varies', 'Vendor\'s', 'Medium'],
    ['Provider-supported monitoring', 'Often covered when eligible', 'Focused on one condition', 'Low for you', 'HIPAA applies to the provider', 'High (clinician reviews)', 'Low', 'Provider\'s', 'Medium'],
    ['Insurer-sponsored program', 'Subsidized', 'Program-specific', 'Low', 'Depends on the program; ask what is shared', 'Varies', 'Low', 'Insurer\'s', 'Low–Medium']
  ];
  var FORMATS = [
    ['Apple Health export.zip / export.xml', 'Supported: streamed, deduplicated, units and time zones checked', 'Private lab and pipeline'],
    ['export_cda.xml (clinical document)', 'Not read yet', 'Records are better imported as FHIR'],
    ['ECG recordings (CSV in the export)', 'Not read yet', 'Planned; shown as unavailable in the inventory'],
    ['Workout routes (GPX in the export)', 'Not read (location is highly identifying)', 'Would need generalization before any use'],
    ['Blood-pressure cuff export (CSV)', 'Supported for the documented sample format', 'Each maker needs its own adapter'],
    ['Scale export (CSV, lb or kg)', 'Supported for the sample format', 'Exact unit conversion'],
    ['Glucose sensor export (CSV)', 'Supported for the sample format', 'Descriptive only'],
    ['FHIR R4: Observation, Condition, MedicationStatement/Request/Dispense, Goal, CarePlan', 'Supported', 'LOINC codes mapped only where certain'],
    ['SMART on FHIR live connection', 'Design only', 'Needs registration with each health system'],
    ['PDF lab reports', 'Not supported', 'Would need a review screen; never guess dates or units'],
    ['HealthKit companion app', 'Design only', 'Needs a native iOS app and App Review']
  ];

  HL.views.privacy = function (root, d) {
    HL.vhead(root, 'Import & Privacy', 'Where is my data coming from, what will be processed, where will it go, and who can see it?', null);
    root.appendChild(h('div', { class: 'grid g3' }, [
      HL.card('1 · Explore the demo', 'You are here. Fictional people, no account, no personal data.', [h('p', null, [h('a', { href: '#/overview/' + d.profile.id, text: 'Health Overview →' })])]),
      HL.card('2 · Analyze locally', 'Your files, read and analyzed in your browser. No upload; that page does not load the site’s page-view counter. Public site: synthetic files only, until the security review passes.', [h('p', null, [h('a', { href: 'private/', text: 'Open My Private Health Lab →' })])]),
      HL.card('3 · Managed service', 'Not available. Designed, not built: a hosted service would need consent, contracts, security operations and a legal review first.', [h('p', { class: 'note', text: 'See the readiness gate in the system design.' })])
    ]));
    root.appendChild(h('div', { style: 'height:16px' }));
    root.appendChild(HL.card('Can Apple provide health data, or analytics, as a service?', '<strong>Data as a Service</strong> means getting authorized data through an API or export. <strong>Analytics as a Service</strong> means paying someone to analyze it. They are different questions. Checked 26 November 2026.', [
      HL.table(['Question', 'What exists', 'Status', 'Source'], FEAS.map(function (r) { return [r[0], r[1], r[2], r[3]]; }), 'Apple feasibility'),
      h('p', { style: 'margin-top:12px', html: '<strong>Conclusion.</strong> Apple offers no paid data or analytics service. Data reaches an analysis only through the person: their export, or an app they install and permit. So the viable designs are local analysis (this lab), a companion app that computes on the phone, an independent service the person chooses, or a clinician or insurer program with its own rules.' })]));
    root.appendChild(h('div', { style: 'height:16px' }));
    root.appendChild(HL.card('Eight ways to get from data to insight', 'An assessment in words, not a score. "High" privacy still depends on the device and the person.', [
      HL.table(['Option', 'Cost', 'Completeness', 'Integration effort', 'Privacy', 'Clinical relevance', 'Portability', 'Maintenance', 'User control'], OPTIONS, 'Comparison')]));
    root.appendChild(h('div', { style: 'height:16px' }));
    root.appendChild(HL.card('Sources and formats', 'What this prototype reads today, and what is design only.', [HL.table(['Source / format', 'In this prototype', 'Note'], FORMATS, 'Compatibility matrix')]));
  };

  // ================================================================== ANONYMITY
  var CONCEPTS = [
    ['Confidentiality', 'Only authorized people see the data.', 'Says nothing about what those people can work out.'],
    ['Encryption', 'Unreadable without the key, in transit or at rest.', 'Whoever holds the key sees everything.'],
    ['Pseudonymization', 'Your name replaced by a random code.', 'The record still describes one person; links can be rebuilt.'],
    ['Removing direct identifiers', 'Names, addresses, numbers removed.', 'Dates, places and rare events still point to you.'],
    ['Formal de-identification (HIPAA)', 'Safe Harbor (remove 18 identifier types) or an expert\'s determination of very small risk.', 'Applies where HIPAA applies; risk is small, not zero.'],
    ['Aggregated statistics', 'Only counts and averages leave.', 'Small groups and repeated queries can still reveal individuals.'],
    ['Differential privacy', 'Calibrated noise limits what any one person changes in a result.', 'Costs accuracy; the privacy budget must be managed.'],
    ['On-device computation', 'Raw data never leaves the device.', 'The device, its apps and its extensions remain risks.'],
    ['Anonymity', 'No reasonable way to identify anyone.', 'Rarely achievable for rich, long-term health records.']
  ];

  HL.views.anonymity = function (root, d) {
    var A = HL.meta.anonymity;
    HL.vhead(root, 'Can My Health Data Really Be Anonymous?', 'What privacy techniques actually do, and what they cannot promise.', null);
    root.appendChild(HL.card('Nine words that are not the same', null, [HL.table(['Technique', 'What it does', 'What it does not do'], CONCEPTS, 'Privacy concepts')]));
    root.appendChild(h('div', { style: 'height:16px' }));
    var max = 100, rows = A.levels;
    var bars = h('div');
    rows.forEach(function (r) {
      bars.appendChild(h('div', { style: 'display:grid;grid-template-columns:minmax(200px,1.4fr) 2fr 70px;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--rule);font-size:14px' }, [
        h('span', { text: r.label }),
        h('span', { style: 'display:block;height:14px;background:var(--surface-2);border-radius:4px;overflow:hidden' }, [h('i', { style: 'display:block;height:100%;width:' + (r.unique_pct / max * 100) + '%;background:var(--s2)' })]),
        h('strong', { class: 'num', text: r.unique_pct + '%' })]));
    });
    root.appendChild(HL.card('Why removing your name is not enough', 'In a synthetic population of ' + A.population.toLocaleString() + ' people, the share who are the only person with that combination of attributes. <span class="illus">Synthetic population</span>', [bars,
      HL.alt('Show as a table', HL.table(['Attributes kept', 'Unique (k = 1)', 'k under 5', 'Median group size', 'Unique among people with the rare condition'], rows.map(function (r) { return [r.label, r.unique_pct + '%', r.k_lt5_pct + '%', r.median_k, r.rare_unique_pct + '%']; }), 'Re-identification')),
      h('p', { class: 'note', style: 'margin-top:8px', text: A.note + ' A long, detailed health history adds many more such attributes: walking routes, timestamps, diagnoses, medicine patterns, rare events.' })]));
    root.appendChild(h('div', { style: 'height:16px' }));
    // DP demo
    var out = h('div'), eps = 1, k = 4;
    function draw() {
      out.innerHTML = '';
      var scale = 1 / eps, half = Math.log(20) / eps, total = eps * k;
      out.appendChild(h('dl', { class: 'kv' }, [
        h('dt', { text: 'True count (synthetic)' }), h('dd', { text: String(A.dp_example.true_count) }),
        h('dt', { text: 'Noise scale (Laplace, 1/ε)' }), h('dd', { text: scale.toFixed(2) }),
        h('dt', { text: '95% of released values fall within' }), h('dd', { text: '±' + half.toFixed(1) }),
        h('dt', { text: 'Privacy budget spent by ' + k + ' such releases' }), h('dd', { text: 'ε = ' + total.toFixed(2) + ' (simple composition)' })]));
      out.appendChild(h('p', { class: 'note', text: 'Smaller ε means more privacy and noisier answers. Every published statistic spends budget; when it runs out, publishing must stop or the guarantee weakens. Arithmetic on your setting, not a recommended value.' }));
    }
    var inp = function (label, val, step, on) { return h('label', null, [label, h('input', { type: 'number', value: val, step: step, min: step, oninput: function (e) { var v = parseFloat(e.target.value); if (v > 0) { on(v); draw(); } } })]); };
    root.appendChild(h('div', { class: 'grid g2' }, [
      HL.card('Differential privacy, in one count', HL.esc(A.dp_example.label) + '. Released with calibrated noise instead of exactly.', [h('div', { class: 'inputs' }, [inp('ε (epsilon) per release', 1, 0.1, function (v) { eps = v; }), inp('Number of releases', 4, 1, function (v) { k = Math.round(v); })]), out]),
      HL.card('HIPAA de-identification, where HIPAA applies', null, [
        h('p', { html: '<strong>Safe Harbor</strong> removes 18 kinds of identifier, including names, small geographic units (a 3-digit ZIP may stay only where that area holds more than 20,000 people), all date elements except the year, ages over 89, and device identifiers, and requires no actual knowledge that what remains could identify someone.' }),
        h('p', { html: '<strong>Expert Determination</strong>: a qualified expert applies statistical methods and documents that the risk of identification is very small. HHS guidance (2012) describes both methods.' }),
        h('p', { class: 'note', text: 'Consumer apps outside HIPAA are not bound by these methods, and meeting them does not make data anonymous in every sense.' })])]));
    draw();
    root.appendChild(h('div', { style: 'height:16px' }));
    root.appendChild(HL.card('The personalization paradox', 'Following one person across years needs continuity; a clinician needs to know who the patient is; a cohort statistic needs neither. So the design keeps three separate boundaries:', [
      h('div', { class: 'grid g3' }, [
        h('div', null, [h('h3', { text: '1 · Your longitudinal record' }), h('p', { text: 'Identified to you only, on your device or in a store only you can open. Full detail: this is where trends come from.' })]),
        h('div', null, [h('h3', { text: '2 · A provider handoff' }), h('p', { text: 'Identified, because the clinician must know whose it is. Minimum necessary: a summary, not every reading. Time-boxed and revocable.' })]),
        h('div', null, [h('h3', { text: '3 · Cohort and research statistics' }), h('p', { text: 'No identity. Only aggregates, with small cells suppressed (this demo hides groups under ' + HL.meta.min_cell + ' people, a product setting, not a legal threshold), dates generalized, and differential privacy where it is justified.' })])]),
      h('p', { class: 'note', text: 'The goal is the most privacy each purpose allows, not a promise that all useful health intelligence can be anonymous.' })]));
  };

  // ================================================================== MY DATA RIGHTS
  var RIGHTS = [
    ['Access', 'From your clinicians and health plans (HIPAA covered entities): a copy of your records, generally within 30 days, with one 30-day extension allowed (45 CFR 164.524). From consumer apps: depends on state law (for example California\'s and Washington\'s) and the app\'s terms.', 'In this lab: everything you import stays on your screen; the demo stores nothing about you.'],
    ['Portability', 'HIPAA access includes an electronic copy in the form you ask for, if readily producible. Certified US health IT offers patient FHIR APIs that apps you choose can use.', 'In this lab: save the summary or the files you imported; nothing is locked in.'],
    ['Deletion', 'HIPAA gives no general right to delete a provider\'s record; it gives a right to request an amendment (45 CFR 164.526). Some state consumer-health laws (for example Washington\'s My Health My Data Act) give a right to delete consumer health data.', 'In this lab: "Delete everything now" ends the worker that held your data; closing the tab does the same.'],
    ['Sharing', 'Most disclosures outside treatment, payment and operations need your written authorization, which you can revoke. Washington\'s law requires separate consent to collect and to share consumer health data.', 'In this lab: nothing is shared. Provider Connect is a simulation.'],
    ['If you are in the EU or UK', 'GDPR treats health data as a special category needing explicit consent or another legal basis (Art. 9), with rights of access, rectification, erasure and portability (Art. 15–20).', 'This prototype is not offered as a service anywhere.'],
    ['The limits of anonymity', 'Removing names does not make a detailed health history anonymous. See "Can It Be Anonymous?".', 'The lab never claims your data is anonymous.']
  ];
  HL.views.rights = function (root) {
    HL.vhead(root, 'My Data Rights', 'Access, portability, deletion and sharing, in plain English.', null);
    root.appendChild(h('div', { class: 'grid g2' }, RIGHTS.map(function (r) { return HL.card(r[0], null, [h('p', { text: r[1] }), h('p', { class: 'note', text: r[2] })]); })));
    root.appendChild(h('p', { class: 'note', style: 'margin-top:14px', text: 'General information, not legal advice. Which law applies depends on who holds the data, why, and where you live.' }));
  };

  // ================================================================== additions to existing views
  var STAT_CLASS = function (s) { return s === 'available' ? 'improving' : (s === 'illustrative only' ? 'changed' : (s === 'partial' || s === 'stale' || s === 'requires reconciliation' || s === 'notification recorded' ? 'declining' : 'insufficient')); };
  HL.coverageCard = function (d) {
    return HL.card('Data coverage and confidence', 'Computed from the data loaded. No measurement → no usable evidence → no conclusion; missing data never means a condition is absent.', [
      h('div', { class: 'rows' }, d.coverage.map(function (c) {
        return h('div', { class: 'row wide' }, [
          h('div', { class: 'nm', text: c.label }), h('span', { class: 'st ' + STAT_CLASS(c.status), text: c.status }), h('div', { class: 'vals', text: c.evidence + (c.status !== 'available' && c.needs ? ' Would help: ' + c.needs : '') })]);
      }))]);
  };
  HL.priorityStrip = function (d) {
    var w = d.overview.windows['90'], ch = Object.keys(w).filter(function (c) { return w[c] && (w[c].status === 'improving' || w[c].status === 'declining'); });
    var miss = d.coverage.filter(function (c) { return c.status !== 'available' && c.status !== 'illustrative only'; });
    var att = d.signals.filter(function (s) { return s.tier === 'discuss' || s.tier === 'context' || s.tier === 'urgent'; });
    var item = function (q, a, href) { return h('div', { class: 'card', style: 'padding:12px 14px' }, [h('p', { class: 'note', style: 'margin:0', text: q }), h('p', { style: 'margin:4px 0 0;font-weight:600;font-size:15px', text: a }), href ? h('a', { href: href, style: 'font-size:13px', text: 'Open →' }) : null]); };
    return h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(180px,1fr))' }, [
      item('What changed?', ch.length ? ch.map(function (c) { return HL.label(c) + ' ' + HL.STATUS[w[c].status].toLowerCase(); }).join(' · ') : 'Nothing beyond the thresholds in 90 days', '#/trends/' + d.profile.id),
      item('What evidence supports it?', d.coverage.filter(function (c) { return c.status === 'available'; }).length + ' measures with good coverage', '#/sources/' + d.profile.id),
      item('What is missing?', miss.length ? miss.slice(0, 3).map(function (c) { return c.label; }).join(', ') + (miss.length > 3 ? ' +' + (miss.length - 3) : '') : 'Nothing your data relies on', null),
      item('What might deserve attention?', att.length ? att.length + ' finding' + (att.length > 1 ? 's' : '') : 'Nothing persistent or unexplained', '#/signals/' + d.profile.id),
      item('What to discuss with a clinician?', att.filter(function (s) { return s.tier === 'discuss'; }).length ? 'Bring the summary' : 'Nothing urgent in the data', '#/provider/' + d.profile.id)]);
  };
  HL.coverageHeatmap = function (d) {
    var M = d.coverage_matrix, W = 860, L = 210, cw = (W - L - 10) / M.months.length, rh = 20, H = M.rows.length * rh + 34;
    var svg = HL.s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Coverage by month for ' + M.rows.length + ' measures over ' + M.months.length + ' months.' });
    M.rows.forEach(function (r, i) {
      svg.appendChild(HL.s('text', { x: L - 8, y: 14 + i * rh + 12, 'text-anchor': 'end' }, [r.label]));
      r.cells.forEach(function (v, j) {
        var f = r.daily ? Math.min(1, v) : Math.min(1, v / 8);
        var rect = HL.s('rect', { x: L + j * cw + 1, y: 14 + i * rh + 1, width: cw - 2, height: rh - 3, rx: 2, fill: f > 0 ? 'var(--s1)' : 'var(--surface-2)', 'fill-opacity': f > 0 ? (0.15 + 0.85 * f).toFixed(2) : 1 });
        rect.appendChild(HL.s('title', null, [r.label + ' · ' + M.months[j] + ': ' + (r.daily ? Math.round(v * 100) + '% of days' : v + ' readings')]));
        svg.appendChild(rect);
      });
    });
    M.months.forEach(function (m, j) { if (m.slice(5) === '01' || j === 0) svg.appendChild(HL.s('text', { x: L + j * cw, y: H - 4 }, [m])); });
    return HL.card('Coverage by month', 'Darker = more days with data (or more readings, for cuff and scale). Gaps are visible before any trend is believed.', [h('div', { class: 'chart' }, [svg]),
      HL.alt('Show as a table', HL.table(['Measure'].concat(M.months), M.rows.map(function (r) { return [r.label].concat(r.cells.map(function (v) { return r.daily ? Math.round(v * 100) + '%' : String(v); })); }), 'Coverage by month'))]);
  };
  function procCard() {
    var E = HL.econ, X = {}; for (var k in E.PROC_DEFAULTS) X[k] = E.PROC_DEFAULTS[k];
    var out = h('div');
    var $ = function (v) { return '$' + Math.round(v).toLocaleString('en-US'); };
    function draw() {
      out.innerHTML = '';
      var rows = [1000, 10000, 100000].map(function (n) { var r = E.processing(n, X); return [n.toLocaleString() + ' people', $(r.localTotal), '$' + r.localPerUser.toFixed(2), $(r.cloudTotal), '$' + r.cloudPerUser.toFixed(2)]; });
      out.appendChild(HL.table(['Users', 'Local-first / month', 'per person', 'Managed cloud / month', 'per person'], rows, 'Processing economics'));
      out.appendChild(h('p', { class: 'note', text: 'Calculated from your assumptions. Fixed costs (security, compliance) dominate at small scale; per-person costs dominate at large scale. Local-first moves storage and compute to people\'s own devices, and with them most of the breach risk.' }));
    }
    var labels = { storageGbPerUser: 'Stored history per person (GB)', storagePrice: 'Storage $ per GB-month', computePerUser: 'Cloud compute $ per person-month', aiPerReport: 'AI explanation $ each (0 = none)', reportsPerUser: 'AI explanations per person-month', supportPerUserCloud: 'Support $ per person-month (cloud)', securityOpsCloud: 'Security operations $ / month (cloud)', complianceCloud: 'Compliance and audit $ / month (cloud)', clinicalReviewPerUser: 'Clinical review $ per person-month (0 = none)', hostingLocal: 'Static hosting $ / month (local)', supportPerUserLocal: 'Support $ per person-month (local)', securityLocal: 'Security review $ / month (local)', complianceLocal: 'Privacy review $ / month (local)' };
    var form = h('div', { class: 'inputs' }, Object.keys(labels).map(function (k) {
      return h('label', null, [h('span', { html: HL.esc(labels[k]) + ' <span class="lbl ass">Your assumption</span>' }), h('input', { type: 'number', step: 'any', value: X[k], oninput: function (e) { var v = parseFloat(e.target.value); if (!isNaN(v)) { X[k] = v; draw(); } } })]);
    }));
    draw();
    return HL.card('Data processing economics: on the device or in the cloud', 'Placeholders, not vendor prices. Apple charges nothing here because Apple offers no such service. Replace every value with your own.', [form, h('div', { style: 'height:12px' }), out]);
  }

  // wrap existing views
  var ov = HL.views.overview;
  HL.views.overview = function (root, d) {
    ov(root, d);
    var who = root.querySelector('.card');
    if (who && who.nextSibling) {
      var box = h('div', null, [h('div', { style: 'height:16px' }), HL.priorityStrip(d), h('div', { style: 'height:16px' }), HL.coverageCard(d)]);
      who.parentNode.insertBefore(box, who.nextSibling);
    }
  };
  var srcV = HL.views.sources;
  HL.views.sources = function (root, d) { srcV(root, d); root.appendChild(h('div', { style: 'height:16px' })); root.appendChild(HL.coverageHeatmap(d)); };
  var ecoV = HL.views.economics;
  HL.views.economics = function (root, d) { ecoV(root, d); root.appendChild(h('div', { style: 'height:16px' })); root.appendChild(procCard()); };

  HL.boot();
})();
