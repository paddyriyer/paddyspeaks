/* My Private Health Lab — the page. Files the person chooses go to a Web Worker on this
   device (worker.js + ../engine.js) and nowhere else. This script fetches only this site's
   own files, and only BEFORE a file is chosen (the import spec) or when the person asks
   for a synthetic sample. The network panel shows every request the browser made after
   the first file was chosen; the tested expectation is zero. */
(function () {
  'use strict';
  var HL = window.HL, h = HL.h;
  try { var t = localStorage.getItem('hlab.theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) { /* storage unavailable */ }
  var LOCAL_DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]allow-real=1/.test(location.search);
  var S = { worker: null, spec: null, files: [], preview: null, result: null, chosenAt: null, net: [], blocked: 0, busy: false, metric: null, period: 730 };
  var app = document.getElementById('app');
  var SAMPLES = [
    ['Alex — Apple Health export (ZIP)', 'alex-apple-health-export.zip', 'A'],
    ['Ben — Apple Health export (ZIP)', 'ben-apple-health-export.zip', 'A'],
    ['Dorothy — Apple Health export (ZIP)', 'dorothy-apple-health-export.zip', 'A'],
    ['A deliberately broken export (XML)', 'malformed-export.xml', 'A'],
    ['Ben — blood-pressure cuff (CSV)', 'ben-blood-pressure-cuff.csv', 'C'],
    ['Ben — scale (CSV)', 'ben-scale.csv', 'C'],
    ['Carmen — glucose sensor (CSV)', 'carmen-glucose-sensor.csv', 'C'],
    ['Carmen — lab results and prescriptions (FHIR)', 'carmen-clinical-records.json', 'D'],
    ['Ben — records, prescriptions, pharmacy fills (FHIR)', 'ben-clinical-records.json', 'E']
  ];

  // ---------------------------------------------------------------- network evidence
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) { if (S.chosenAt != null && e.startTime >= S.chosenAt) { S.net.push(e.name); renderNet(); } });
    }).observe({ type: 'resource', buffered: true });
  } catch (e) { /* older browser: the counter stays unavailable */ }
  document.addEventListener('securitypolicyviolation', function (e) { S.blocked++; S.net.push('BLOCKED by policy: ' + e.blockedURI); renderNet(); });
  function renderNet() {
    var el = document.getElementById('netcount');
    if (el) el.textContent = S.chosenAt == null ? '—' : String(S.net.length);
    var log = document.getElementById('netlog');
    if (log) log.textContent = S.chosenAt == null ? 'Nothing chosen yet.' : (S.net.length ? S.net.join('\n') : 'None. Since you chose a file, this page has made no network request.');
  }
  function status(text, cls) { var e = document.getElementById('st-mode'); e.innerHTML = '<b>My Private Health Lab</b> · ' + (cls ? '<span class="' + cls + '">' + HL.esc(text) + '</span>' : HL.esc(text)); }

  // ---------------------------------------------------------------- boot: load the spec BEFORE any file is chosen
  fetch('../data/meta.json').then(function (r) { return r.json(); }).then(function (meta) {
    HL.meta = meta; S.spec = meta.import_spec;
    S.worker = new Worker('worker.js');
    S.worker.onmessage = onWorker;
    S.worker.postMessage({ type: 'init', spec: S.spec });
    render();
  }).catch(function (e) { app.textContent = 'Could not load the lab: ' + e.message; });

  document.getElementById('theme').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('hlab.theme', next); } catch (e) { /* fine */ }
    if (S.result) renderResults();
  });

  // ---------------------------------------------------------------- screens
  function render() {
    app.innerHTML = '';
    app.appendChild(h('section', { class: 'hero', style: 'padding:22px 0 6px' }, [
      h('p', { class: 'kicker', text: 'Explore · Data Import & Privacy Center' }),
      h('h1', { text: 'My Private Health Lab' }),
      h('p', { class: 'tag', text: 'Where is my data coming from, what will be processed, where will it go, and who can see it?' })
    ]));
    if (LOCAL_DEV) app.appendChild(h('p', { class: 'err', text: 'Local development mode: real (unmarked) files are accepted because this page is served from your own computer. This mode cannot be turned on from the public site.' }));
    app.appendChild(modes());
    app.appendChild(h('div', { style: 'height:18px' }));
    app.appendChild(sources());
    app.appendChild(h('div', { style: 'height:18px' }));
    app.appendChild(h('section', { id: 'stage' }));
    app.appendChild(h('div', { style: 'height:18px' }));
    app.appendChild(privacyCenter());
    renderNet();
  }

  function modes() {
    return HL.card('Three ways to use the lab', 'Each one has different privacy consequences. Read them before you choose.', [h('div', { class: 'modes' }, [
      h('div', { class: 'mode' }, [h('span', { class: 'tagline', text: 'Mode 1' }), h('h3', { text: 'Explore the demo' }),
        h('p', { text: 'Five fictional people, every chart working. No account, no personal data.' }),
        h('ul', null, [h('li', { text: 'Safe to share and present' }), h('li', { text: 'Clearly labelled synthetic' })]),
        h('p', null, [h('a', { href: '../', text: 'Open the synthetic demo →' })])]),
      h('div', { class: 'mode on' }, [h('span', { class: 'tagline', text: 'Mode 2 · you are here' }), h('h3', { text: 'Analyze locally' }),
        h('p', { text: 'Your files are read and analyzed inside this browser tab, in a worker, in memory.' }),
        h('ul', null, [h('li', { text: 'No upload, no account, no analytics on this page' }), h('li', { text: 'Deleted when you close the tab or press Delete' }),
          h('li', { text: 'Public site: synthetic files only, until the security review passes' })])]),
      h('div', { class: 'mode off' }, [h('span', { class: 'tagline', text: 'Mode 3 · not available' }), h('h3', { text: 'Managed analytics service' }),
        h('p', { text: 'Designed, not built. Before any upload a real service would have to show all of this, and get your explicit permission:' }),
        h('details', null, [h('summary', { text: 'What you would be told first' }), h('ul', null, ['Exactly which data would be transferred', 'Who receives it, and where it is processed', 'Why: the specific purpose', 'Subprocessors', 'Whether any external AI service is involved', 'How long it is kept', 'Encryption and who can access it', 'Whether any clinician or insurer sees the results', 'What it costs', 'Your rights: access, export, deletion', 'Which laws and contracts protect it (HIPAA only applies in some arrangements)'].map(function (t) { return h('li', { text: t }); }))])])
    ])]);
  }

  function sources() {
    var input = h('input', { type: 'file', multiple: true, accept: '.zip,.xml,.csv,.json', class: 'vh', id: 'pick' });
    input.addEventListener('change', function () { addFiles(Array.prototype.slice.call(input.files)); input.value = ''; });
    var drop = h('label', { class: 'drop', for: 'pick' }, [h('strong', { text: 'Choose files' }), ' or drop them here: Apple Health export (.zip or .xml), device files (.csv), clinical records (.json, FHIR R4).']);
    ['dragenter', 'dragover'].forEach(function (k) { drop.addEventListener(k, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (k) { drop.addEventListener(k, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { addFiles(Array.prototype.slice.call(e.dataTransfer.files)); });
    var sample = function (code) {
      return h('div', { class: 'btns' }, SAMPLES.filter(function (s) { return s[2] === code; }).map(function (s) {
        return h('button', { type: 'button', class: 'btn ghost', onclick: function () { loadSample(s[1]); }, text: 'Use sample: ' + s[0] });
      }));
    };
    var src = function (letter, title, label, kids) { return h('div', { class: 'src' }, [h('span', { class: 'lbl' + (label === 'Working' ? ' calc' : ''), text: 'Source ' + letter + ' · ' + label }), h('h3', { text: title })].concat(kids)); };
    return HL.card('Import my data', 'Choose where your data comes from. Files stay on this device. <strong>On the public site, only PaddySpeaks synthetic files are accepted</strong>: they carry a marker, and anything without it is refused before analysis.', [
      h('div', { class: 'sources' }, [
        src('A', 'Apple Health export', 'Working', [
          h('ol', null, ['Open the Health app on iPhone.', 'Tap your profile picture.', 'Choose Export All Health Data.', 'Save export.zip somewhere private.', 'Open this page.', 'Choose the file below.', 'Review what was found.', 'Pick the period and measures.', 'Run the analysis on this device.'].map(function (t) { return h('li', { text: t }); })),
          h('p', { text: 'The ZIP holds export.xml (read here, streamed, so large files work), plus ECG and route files this prototype does not read yet. A website cannot read HealthKit directly.' }), sample('A')]),
        src('B', 'HealthKit companion app', 'Design only', [
          h('p', { text: 'A future iOS app would ask for each data type separately and say why, read only what you allow, sync new samples incrementally (an observer query wakes it, an anchored query fetches changes), handle revoked permissions, keep provenance, and compute on the phone by default.' }),
          h('p', { text: 'Apple\'s rules: health data may not be used for advertising or sold; sharing for research needs your consent. There is no Apple server API for HealthKit data.' })]),
        src('C', 'Medical devices', 'Working', [
          h('p', { text: 'Blood-pressure cuffs, scales, glucose sensors: from the maker\'s export file. Integrations are added only where a maker documents an export or API; not every device is clinical-grade, and the lab says which kind each reading is.' }), sample('C')]),
        src('D', 'Laboratory results', 'Working (FHIR)', [
          h('p', { text: 'Structured FHIR R4 Observations (HbA1c, glucose, lipids, creatinine). PDF reports are not read: a real version would need a review screen, and would never guess a date, unit or range.' }), sample('D')]),
        src('E', 'Medications', 'Working (FHIR)', [
          h('p', { text: 'Prescriptions, pharmacy fills and medication lists are kept separately. An old prescription never makes a medicine current; conflicts are flagged, never resolved by the app.' }), sample('E')]),
        src('F', 'Health records (SMART on FHIR)', 'Design only', [
          h('p', { text: 'Patient-authorized access through your health system\'s patient API: sign in with them (OAuth 2.0), approve read-only scopes, then Read → Analyze locally → Summarize → Share. Reading records does not create a way to send anything back.' })])
      ]),
      h('div', { style: 'height:12px' }), input, drop,
      h('ul', { class: 'filelist', id: 'files' }),
      h('div', { class: 'btns', style: 'margin-top:10px' }, [
        h('button', { type: 'button', class: 'btn', id: 'go', onclick: runImport, text: 'Read the files on this device' }),
        h('button', { type: 'button', class: 'btn ghost', id: 'cancel', onclick: function () { S.worker.postMessage({ type: 'cancel' }); }, text: 'Cancel' })]),
      h('div', { id: 'progress' })
    ]);
  }

  function addFiles(list) {
    if (!list.length) return;
    if (S.chosenAt == null) { S.chosenAt = performance.now(); S.net = []; }
    list.forEach(function (f) { S.files.push({ name: f.name, blob: f }); });
    renderFiles(); renderNet();
  }
  function loadSample(name) {
    // a synthetic sample is downloaded from this site; the request is made before the clock starts
    fetch('../samples/' + name).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function (b) {
      setTimeout(function () { addFiles([new File([b], name)]); }, 50);
    }).catch(function (e) { showError('Could not load the sample: ' + e.message); });
  }
  function renderFiles() {
    var ul = document.getElementById('files'); if (!ul) return;
    ul.innerHTML = '';
    S.files.forEach(function (f, i) {
      ul.appendChild(h('li', null, [h('span', { class: 'n', text: f.name + ' · ' + Math.round(f.blob.size / 1024) + ' KB' }),
        h('button', { type: 'button', class: 'btn ghost', onclick: function () { S.files.splice(i, 1); renderFiles(); }, text: 'Remove' })]));
    });
  }
  function showError(msg) { var p = document.getElementById('progress'); p.innerHTML = ''; p.appendChild(h('p', { class: 'err', role: 'alert', text: msg })); }

  function runImport() {
    if (!S.files.length) return showError('Choose at least one file first.');
    if (S.busy) return;
    S.busy = true; S.result = null;
    var p = document.getElementById('progress'); p.innerHTML = '';
    p.appendChild(h('p', { id: 'ptext', text: 'Reading on this device…' }));
    p.appendChild(h('div', { class: 'bar' }, [h('i', { id: 'pbar' })]));
    status('reading your files on this device', 'ok');
    S.worker.postMessage({ type: 'reset' });
    S.worker.postMessage({ type: 'import', files: S.files, allowReal: LOCAL_DEV });
  }

  function onWorker(ev) {
    var m = ev.data, p = document.getElementById('progress');
    if (m.type === 'progress') {
      var t = document.getElementById('ptext'), bar = document.getElementById('pbar');
      if (t) t.textContent = 'Reading ' + m.name + ' on this device: ' + Math.round(m.chars / 1000).toLocaleString() + ' thousand characters';
      if (bar) bar.style.width = m.total ? Math.min(100, 100 * m.chars / m.total) + '%' : '60%';
    } else if (m.type === 'file' && m.result.refused) {
      p.appendChild(h('p', { class: 'err', role: 'alert', text: m.result.name + ' was refused: it does not carry the PaddySpeaks synthetic-data marker. Real health data cannot be analyzed on the public site until this private mode passes its security and privacy review. Nothing was uploaded; only the first few kilobytes were read, on this device, to look for the marker.' }));
    } else if (m.type === 'imported') {
      S.busy = false; S.preview = m.preview;
      var bar2 = document.getElementById('pbar'); if (bar2) bar2.style.width = '100%';
      status('files read on this device; nothing has left it', 'ok');
      renderPreview();
    } else if (m.type === 'result') {
      S.result = m.result; renderResults();
      status('Your selected data are being processed on this device.', 'ok');
    } else if (m.type === 'error') {
      S.busy = false; showError(m.message); status('import stopped; nothing was kept', 'warn');
    }
  }

  // ---------------------------------------------------------------- Screen 3a: preview, period and measures
  function renderPreview() {
    var st = document.getElementById('stage'); st.innerHTML = '';
    var pv = S.preview;
    if (!pv.measures.length && !pv.clinical) { st.appendChild(HL.card('Nothing usable was found', null, [h('p', { text: 'No supported measurements in these files. Check the import log below each file, or try a sample.' })])); return; }
    var boxes = pv.measures.map(function (m) {
      return h('label', null, [h('input', { type: 'checkbox', checked: true, value: m.code }), h('span', null, [h('strong', { text: m.label }), ' ', HL.kind(m.kind), h('span', { class: 'note', text: ' · ' + m.n.toLocaleString() + ' · ' + m.first + ' to ' + m.last + ' · ' + m.sources.join(', ') })])]);
    });
    var latest = pv.latest || new Date().toISOString().slice(0, 10);
    st.appendChild(HL.card('What was found (nothing analyzed yet)', 'Choose what to include. Unchecked measures are left out of every calculation.', [
      h('div', { class: 'checks', id: 'codes' }, boxes),
      h('p', { class: 'note', text: pv.workouts + ' workouts · ' + pv.notifications + ' device notifications · ' + pv.clinical + ' clinical records (conditions, medicines, goals). Latest measurement: ' + latest + '.' }),
      h('div', { class: 'filters' }, [h('label', { class: 'field' }, ['Period', h('select', { id: 'period' }, [[730, 'Two years to ' + latest], [365, 'One year to ' + latest], [180, '180 days to ' + latest]].map(function (o) { return h('option', { value: o[0], text: o[1] }); }))]),
        h('button', { type: 'button', class: 'btn', onclick: function () {
          var codes = Array.prototype.slice.call(document.querySelectorAll('#codes input:checked')).map(function (i) { return i.value; });
          var period = +document.getElementById('period').value; S.period = period;
          var from = new Date(latest + 'T00:00:00Z'); from.setUTCDate(from.getUTCDate() - (period - 1));
          S.worker.postMessage({ type: 'analyze', asOf: latest, codes: codes, from: from.toISOString().slice(0, 10) });
        }, text: 'Analyze on this device' })])
    ]));
  }

  // ---------------------------------------------------------------- results: inventory, dashboard, summary
  function renderResults() {
    var R = S.result, st = document.getElementById('stage'); st.innerHTML = '';
    HL.data = { start: R.start, days: R.days };
    // Screen 3: inventory
    st.appendChild(HL.card('Data inventory and confidence', 'Computed from the files you loaded, as of ' + R.as_of + '. No measurement → no usable evidence → no conclusion.', [
      h('div', { class: 'covgrid' }, R.coverage.map(function (c) {
        return h('div', { class: 'cov', 'data-s': c.status }, [h('b', { text: c.label }), h('span', { class: 's', text: c.status }), h('p', { text: c.evidence }),
          c.status !== 'available' ? h('p', { class: 'note', text: 'Would help: ' + c.needs }) : null, c.conclusion ? h('p', { class: 'note', text: c.conclusion }) : null]);
      })),
      h('h3', { style: 'margin:16px 0 6px;font-size:15px', text: 'What happened to each file' }),
      HL.table(['File', 'Kept', 'Duplicates', 'Rejected', 'Skipped', 'Reasons'], Object.keys(R.files).map(function (f) {
        var x = R.files[f]; return [f, x.kept, x.duplicate, x.rejected, x.skipped, x.reasons.map(function (r) { return r[0] + ': ' + r[1] + ' (' + r[2] + ')'; }).join('; ') || '—'];
      }), 'Import log'),
      h('p', { class: 'note', text: 'Time zones seen: ' + (R.timezones.join(', ') || 'none') + (R.away_days ? ' · ' + R.away_days + ' days recorded away from home, counted on the local day as lived.' : '') })
    ]));
    st.appendChild(h('div', { style: 'height:16px' }));
    // trends
    var w = R.windows[90] || {}, codes = Object.keys(R.series);
    if (codes.length) {
      if (!S.metric || codes.indexOf(S.metric) < 0) S.metric = codes[0];
      var rows = h('div', { class: 'rows' }, Object.keys(w).map(function (code) {
        var x = w[code];
        return h('div', { class: 'row' }, [h('div', { class: 'nm' }, [h('button', { type: 'button', class: 'btn ghost', onclick: function () { S.metric = code; renderResults(); }, text: HL.label(code) })]),
          HL.status(x.status), h('div', { class: 'vals num', text: x.status === 'insufficient' ? 'Not enough data to compare' : HL.fmt(x.prev, code) + ' → ' + HL.fmt(x.cur, code) }),
          h('div', { class: 'spark' }, [HL.spark(R.series[code][HL.meta.metrics[code].cadence === 'sparse' ? 'v' : 'med'].slice(-365), { compact: HL.meta.metrics[code].cadence === 'sparse' })])]);
      }));
      var s = R.series[S.metric], dates = HL.dates();
      st.appendChild(h('div', { class: 'grid' }, [
        HL.card(HL.label(S.metric), 'Unit ' + HL.unit(S.metric) + ' · each dot one day or reading · line the 28-day median · band its middle half. Source: your files.', [
          HL.lineChart({ dates: dates, code: S.metric, height: 280, series: [{ label: 'Each day', values: s.v, color: 'var(--s1)', mode: 'dots', r: 1.8, opacity: 0.5 }, { label: '28-day median', values: s.med, color: 'var(--s1)' }],
            band: { lo: s.p25, hi: s.p75, label: 'Middle half of the last 28 days' }, aria: HL.label(S.metric) + ' over the selected period.' })]),
        HL.card('Last 90 days against the 90 before', 'Same thresholds and coverage rules as the demo; tested to match it.', [rows])]));
      st.appendChild(h('div', { style: 'height:16px' }));
    }
    // signals + meds + labs
    var sig = R.signals.filter(function (x) { return x.tier !== 'observed' || x.kind === 'data_issue'; });
    st.appendChild(h('div', { class: 'grid g2' }, [
      HL.card('Findings worth a look', sig.length ? 'Each shows its evidence and limits. Nothing here is a diagnosis.' : 'Nothing persistent or unexplained.', sig.map(function (x) {
        return h('div', { class: 'sig ' + x.tier, style: 'margin-bottom:10px' }, [h('h3', null, [HL.tier(x.tier), x.label]), h('p', { text: x.why }), x.limits ? h('p', { class: 'note', text: 'Limits: ' + x.limits }) : null, h('p', null, [h('strong', { text: x.next })])]);
      })),
      HL.card('Medications', R.medications.length ? 'Every source kept; the app resolves nothing.' : 'No medication records loaded.', R.medications.map(function (m) {
        return h('div', { style: 'margin-bottom:10px' }, [h('p', null, [h('strong', { text: m.name }), ' ', h('span', { class: 'lbl', text: m.status })]), h('ul', { class: 'plain' }, m.sources.map(function (x) { return h('li', { text: x.text }); }).concat(m.reasons.map(function (x) { return h('li', null, [h('strong', { text: x })]); })))]);
      }).concat(Object.keys(R.labs).length ? [h('h3', { style: 'margin:14px 0 6px;font-size:15px', text: 'Laboratory results' }), HL.table(['Test', 'Date', 'Result', 'As reported'], [].concat.apply([], Object.keys(R.labs).map(function (k) { return R.labs[k].map(function (r) { return [HL.label(k), r.date, HL.fmt(r.value, k), r.orig]; }); })), 'Lab results')] : []))
    ]));
    st.appendChild(h('div', { style: 'height:16px' }));
    // clinician handoff (local only)
    st.appendChild(HL.card('Clinician summary: choose → preview → export (on this device)', 'Authorize, deliver and confirm need a verified connection to your health system; this prototype has none, so it stops at a file you can save and bring yourself.', [
      h('div', { class: 'btns' }, [
        h('button', { type: 'button', class: 'btn', onclick: function () { HL.download('my-health-summary.md', summaryMd(R), 'text/markdown'); }, text: 'Save summary (.md)' }),
        h('button', { type: 'button', class: 'btn ghost', onclick: function () { window.print(); }, text: 'Print or save as PDF' })]),
      h('p', { class: 'note', text: 'Saving creates a file on this device; nothing is sent. A summary someone receives is not monitoring.' })]));
    renderNet();
  }

  function summaryMd(R) {
    var L = ['# Patient-generated health summary', '', '_Prepared on my own device with the PaddySpeaks private lab (prototype). As of ' + R.as_of + '. Not continuous monitoring; no diagnosis or medication advice was generated._', '', '## Measurements (last 90 days against the 90 before)', '', '| Measure | Before | After | Status |', '|---|---|---|---|'];
    var w = R.windows[90] || {};
    Object.keys(w).forEach(function (c) { var x = w[c]; L.push('| ' + HL.label(c) + ' | ' + HL.fmt(x.prev, c) + ' | ' + HL.fmt(x.cur, c) + ' | ' + HL.STATUS[x.status] + ' |'); });
    L.push('', '## Open questions');
    R.signals.filter(function (x) { return x.tier === 'discuss' || x.tier === 'context'; }).forEach(function (x) { L.push('- ' + x.label + ': ' + x.why); });
    L.push('', '## Medications (all sources kept)');
    R.medications.forEach(function (m) { L.push('- ' + m.name + ': ' + m.status + (m.reasons.length ? ' — ' + m.reasons.join(' ') : '')); });
    L.push('', '## Data quality');
    R.coverage.forEach(function (c) { L.push('- ' + c.label + ': ' + c.status + '. ' + c.evidence); });
    return L.join('\n') + '\n';
  }

  // ---------------------------------------------------------------- Screen 4: privacy control center
  function privacyCenter() {
    return HL.card('Privacy control center', 'What this page does with your files, checked by the browser, not just stated.', [
      h('dl', { class: 'privacy' }, [
        h('dt', { text: 'What stays on this device' }), h('dd', { text: 'Everything you choose. Files are read by a worker inside this tab and kept in its memory only.' }),
        h('dt', { text: 'What has been shared' }), h('dd', { text: 'Nothing. There is no upload code on this page, and its security policy blocks requests to any other site.' }),
        h('dt', { text: 'Recipients' }), h('dd', { text: 'None.' }),
        h('dt', { text: 'Retention' }), h('dd', { text: 'Until you close the tab or press Delete. Nothing is written to browser storage except your light/dark theme choice.' }),
        h('dt', { text: 'Analytics and AI' }), h('dd', { text: 'None on this page: no page-view pixel, no platform script, no web fonts, no AI service.' }),
        h('dt', { text: 'Network requests since you chose a file' }), h('dd', null, [h('pre', { class: 'netlog', id: 'netlog', tabindex: '0' })])
      ]),
      h('div', { class: 'btns', style: 'margin-top:12px' }, [h('button', { type: 'button', class: 'btn', onclick: wipe, text: 'Delete everything now' })]),
      h('details', { class: 'alt' }, [h('summary', { text: 'What this cannot protect you from' }), h('ul', { class: 'plain' }, [
        'A compromised device, or a browser extension that can read every page you open.',
        'A shared computer: other people could use the same tab before you close it.',
        'The code itself: it is downloaded from this site each visit. You can read it (engine.js, worker.js, private.js) or run it from your own copy.',
        'Screenshots, printed or saved summaries: once you save a file, it is yours to protect.',
        '"Local" is not "anonymous": your own data describes you, wherever it is processed.'
      ].map(function (t) { return h('li', { text: t }); }))])
    ]);
  }
  function wipe() {
    if (S.worker) S.worker.terminate();
    S.chosenAt = null; S.net = [];   // nothing is held any more; the fresh worker's own files are not your data
    S.files = []; S.preview = null; S.result = null; S.metric = null; S.busy = false;
    S.worker = new Worker('worker.js'); S.worker.onmessage = onWorker; S.worker.postMessage({ type: 'init', spec: S.spec });
    render();
    status('everything deleted from this tab', 'ok');
    var st = document.getElementById('stage');
    st.appendChild(h('p', { class: 'okbox', role: 'status', text: 'Deleted. The worker that held your data was terminated and a new, empty one started. Files on your disk are untouched.' }));
  }
})();
