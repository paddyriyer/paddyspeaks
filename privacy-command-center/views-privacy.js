/* Views: Privacy (Reviewer + Builder work). */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk, fmtDays = P.fmtDays;
var V = P.views;

/* ════════════ RISK RADAR ════════════ */
V['privacy/risks'] = { title: 'Risk Radar', render: function (s, q) {
  var rs = P.risksSorted(), sel = q.r && P.get(q.r) ? P.get(q.r).obj : rs[0];
  var head = NS.riskFactors.map(function (f) { return '<th title="' + esc(f.label) + '" class="rot"><span>' + esc(f.label.replace(' / regulatory exposure', '').replace('Ability to ', '')) + '</span></th>'; }).join('');
  var rows = rs.map(function (r) {
    var c = P.riskCalc(r);
    return '<tr class="click' + (r === sel ? ' sel' : '') + '" data-go="privacy/risks?r=' + r.id + '" tabindex="0"><td><b>' + esc(r.name) + '</b><div class="small dim mono">' + r.id + '</div></td>' + NS.riskFactors.map(function (f) { var v = r.f[f.k], as = f.kind === 'assurance'; var bg = as ? 'rgba(11,125,96,' + (0.08 + v / 5 * 0.6) + ')' : 'rgba(192,71,15,' + (0.06 + v / 5 * 0.7) + ')'; return '<td class="hm" style="background:' + bg + '">' + v + '</td>'; }).join('') + '<td class="num"><b>' + c.residual + '</b></td><td>' + P.sev(c.rating) + '</td></tr>';
  }).join('');
  return P.pageHead('Privacy', 'Executive privacy risk radar', 'No mysterious score. Nine exposure factors (coral) and three assurance factors (teal), each scored 0–5 with a stated reason. Residual = exposure × (1 − 0.6 × assurance). Click a row to see WHY.') +
    '<div class="tbl-wrap" style="margin-bottom:14px"><table class="tbl riskt"><thead><tr><th>Asset</th>' + head + '<th class="num">Residual</th><th>Rating</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    P.riskWhy(sel) + '<div class="btn-row">' + chip(sel.asset) + sel.findings.map(function (f) { return chip(f); }).join('') + '<a class="btn" href="#/report/executive?r=' + sel.id + '">Write the executive memo →</a></div>' +
    '<style>.riskt th.rot{height:92px;vertical-align:bottom;white-space:nowrap;padding:4px}.riskt th.rot span{display:inline-block;writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px}.riskt td.hm{text-align:center;font:600 12px var(--mono);padding:9px 4px;min-width:28px}.riskt tr.sel td{box-shadow:inset 0 1px 0 var(--info),inset 0 -1px 0 var(--info)}</style>';
} };

/* ════════════ WORST DAY — BREACH BUDGET ════════════ */
var DESIGNS = [
  ['CURRENT', 'Current design', function (a) { return a; }],
  ['MINIMIZED', 'Minimised', function (a) { return { rec: a.rec * 0.6, fields: Math.max(2, Math.round(a.fields * 0.45)), sens: Math.max(1, a.sens - 1), days: a.days, ident: a.ident, link: Math.max(1, a.link - 1), key: a.key, vendors: Math.max(0, a.vendors - 1), infer: Math.max(0, a.infer - 2) }; }],
  ['SHORT RETENTION', 'Short retention', function (a) { return { rec: a.rec * Math.min(1, 30 / Math.max(a.days, 30)), fields: a.fields, sens: a.sens, days: Math.min(a.days, 30), ident: a.ident, link: a.link, key: a.key, vendors: a.vendors, infer: Math.max(0, a.infer - 1) }; }],
  ['TOKENIZED', 'Tokenised', function (a) { return { rec: a.rec, fields: a.fields, sens: a.sens, days: a.days, ident: Math.max(1, a.ident - 2), link: Math.max(1, a.link - 2), key: 'token vault (separate team)', vendors: a.vendors, infer: a.infer }; }],
  ['ISOLATED', 'Isolated + per-user keys', function (a) { return { rec: a.rec * 0.2, fields: a.fields, sens: a.sens, days: a.days, ident: a.ident, link: 1, key: 'per-user keys (HSM)', vendors: 0, infer: Math.max(0, a.infer - 2) }; }],
  ['ON-DEVICE', 'On-device', function (a) { return { rec: 0, fields: 0, sens: 0, days: 0, ident: 0, link: 0, key: 'the person\'s device', vendors: 0, infer: 0 }; }]
];
var ASSETS = {
  d_lochist: { rec: 26e6 * 547 * 4, fields: 7, sens: 3, days: 547, ident: 5, link: 4, key: 'Platform KMS (company)', vendors: 2, infer: 4, inf: ['home and work', 'daily routine', 'clinic or place-of-worship visits', 'who lives together'] },
  d_prompts: { rec: 22e6 * 400 * 0.8, fields: 5, sens: 4, days: 400, ident: 4, link: 3, key: 'Platform KMS (company)', vendors: 1, infer: 4, inf: ['health conditions', 'relationships', 'money trouble', 'work secrets'] },
  d_identity_graph: { rec: 180e6 * 6, fields: 7, sens: 3, days: 820, ident: 5, link: 5, key: 'Cloud provider managed', vendors: 1, infer: 3, inf: ['health-app users by name', 'every device a person owns', 'household membership'] },
  d_transcripts: { rec: 17e6 * 4, fields: 5, sens: 3, days: 365, ident: 4, link: 2, key: 'Support KMS', vendors: 2, infer: 2, inf: ['complaints', 'order history', 'contact details'] },
  d_applogs: { rec: 212e6 * 40, fields: 5, sens: 2, days: 395, ident: 4, link: 3, key: 'Platform KMS (company)', vendors: 0, infer: 1, inf: ['who reset their password, when'] },
  d_pulsecycle: { rec: 3.1e6 * 365, fields: 5, sens: 4, days: 365, ident: 3, link: 1, key: 'per-user keys (HSM)', vendors: 0, infer: 2, inf: ['cycle', 'symptoms'] }
};
P.state.worst = P.state.worst || 'd_lochist';
function damage(a) { return a.rec <= 0 ? 0 : Math.log10(a.rec + 1) * (a.sens + 1) * (a.ident + 1) * (/per-user|device/.test(a.key) ? 0.2 : /vault|separate/.test(a.key) ? 0.55 : 1) * (1 + a.vendors * 0.25) * Math.max(0.2, Math.log10(a.days + 1) / 2.7); }
V['privacy/worstday'] = { title: 'Worst Day', render: function () {
  var id = P.state.worst, a = ASSETS[id], d = P.get(id).obj;
  var base = damage(a);
  var cols = DESIGNS.map(function (x) {
    var b = x[2](a), dm = damage(b), rel = base ? dm / base : 0, r = 14 + 96 * Math.sqrt(rel);
    return '<div class="wd-col' + (x[0] === 'CURRENT' ? ' cur' : '') + '"><div class="mono small dim">' + x[0] + '</div><svg viewBox="0 0 240 240" width="100%" style="max-width:220px" role="group" aria-label="' + esc(x[1]) + ' blast radius ' + Math.round(rel * 100) + ' percent"><circle cx="120" cy="120" r="112" fill="none" stroke="#e7e1d5" stroke-dasharray="2 5"/><circle cx="120" cy="120" r="' + r.toFixed(1) + '" fill="' + (rel > 0.6 ? '#c42d49' : rel > 0.25 ? '#c0470f' : rel > 0.02 ? '#946300' : '#0b7d60') + '" fill-opacity=".22" stroke="' + (rel > 0.6 ? '#c42d49' : rel > 0.25 ? '#c0470f' : rel > 0.02 ? '#946300' : '#0b7d60') + '"/><text x="120" y="126" fill="#1d2430" font-size="26" font-weight="700" text-anchor="middle">' + Math.round(rel * 100) + '%</text></svg>' +
      '<ul class="wd-l"><li><span>rows (est.)</span><b>' + (b.rec ? fmtN(Math.round(b.rec)) : '0') + '</b></li><li><span>oldest</span><b>' + (b.days ? fmtDays(b.days) : '—') + '</b></li><li><span>sensitivity</span><b>' + (b.sens ? 'T' + b.sens : '—') + '</b></li><li><span>identifiable</span><b>' + b.ident + '/5</b></li><li><span>linkable</span><b>' + b.link + '/5</b></li><li><span>vendors w/ copies</span><b>' + b.vendors + '</b></li><li><span>key holder</span><b class="small">' + esc(b.key) + '</b></li></ul></div>';
  }).join('');
  return P.pageHead('Privacy · show me my worst day', 'The breach budget', 'You can’t promise zero. You can decide, before launch, the most a failure could ever cost. <span class="mono small">DAMAGE = WHAT YOU COLLECTED × HOW LONG YOU KEPT IT × HOW IDENTIFIABLE × WHO HOLDS THE KEY</span>') +
    '<div class="toolbar"><label class="small muted" for="wdSel">If this were compromised today:</label><select id="wdSel">' + Object.keys(ASSETS).map(function (k) { return '<option value="' + k + '"' + (k === id ? ' selected' : '') + '>' + esc(P.get(k).obj.name) + ' — ' + esc(P.name(P.get(k).obj.system)) + '</option>'; }).join('') + '</select></div>' +
    '<div class="grid g-main" style="margin-bottom:14px"><div class="card"><h2 class="sec" style="margin-bottom:10px">What an attacker, a subpoena or a new product idea could reach</h2>' + P.kv([
      ['Personal data exposed', d.fields.map(function (f) { return '<span class="mono small">' + esc(f[0]) + '</span>'; }).join(', ')], ['How old', d.age == null ? unk() : fmtDays(d.age)], ['How sensitive', P.tier(P.dsTier(d))],
      ['How identifiable', a.ident + ' / 5 — ' + P.dsIds(d).map(P.name).join(', ')], ['How linkable', a.link + ' / 5'], ['People affected', fmtN(d.people)], ['Who holds the keys', esc(d.keyOwner)],
      ['Vendors with copies', a.vendors ? String(a.vendors) : 'none'], ['What can be inferred', a.inf.map(function (x) { return '<span class="warn">' + esc(x) + '</span>'; }).join(' · ')]]) + '</div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:8px">The same event, six designs</h2><p class="small muted">Each column applies one architectural change to the current design. The ring is the blast radius relative to today.</p><div class="callout" style="margin-top:10px">The only data that can’t be subpoenaed, breached, or sold is data you never kept.</div>' + P.chip(id, 'Open the passport') + '</div></div>' +
    '<div class="wd">' + cols + '</div>' +
    '<p class="small dim" style="margin-top:10px">Illustrative model: damage ∝ log(records) × (sensitivity+1) × (identifiability+1) × key-custody factor × (1 + 0.25 × vendors) × retention factor. Architecture changes the blast radius more than any policy.</p>' +
    '<style>.wd{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.wd-col{border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--panel);text-align:center}.wd-col.cur{border-color:rgba(192,71,15,.5)}.wd-l{list-style:none;padding:0;margin:6px 0 0;text-align:left;font-size:12px}.wd-l li{display:flex;justify-content:space-between;gap:6px;padding:3px 0;border-bottom:1px solid var(--line)}.wd-l span{color:var(--dim)}@media(max-width:1100px){.wd{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:600px){.wd{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>';
}, mount: function (root) { root.querySelector('#wdSel').addEventListener('change', function () { P.state.worst = this.value; P._keepScroll = true; P.render(); }); } };

/* ════════════ REVIEWS + WORKBENCH ════════════ */
V['privacy/reviews'] = { title: 'Reviews', render: function (s) {
  if (s[0] && P.get(s[0])) return workbench(s[0]);
  var cols = NS.reviewStages.map(function (st) {
    var rs = NS.reviews.filter(function (r) { return r.stage === st; });
    return '<div class="kcol"><div class="kh"><span class="mono small">' + st + '</span><span class="mono small dim">' + rs.length + '</span></div>' + rs.map(function (r) {
      return '<a class="kc" href="#/privacy/reviews/' + r.feature + '"><div style="display:flex;justify-content:space-between;gap:6px">' + P.sev(r.risk) + '<span class="mono small dim">' + r.id + '</span></div><div style="font-weight:600;margin:6px 0 2px">' + esc(P.name(r.feature)) + '</div><div class="small muted">' + r.age + ' d · ' + (r.reviewer ? esc(r.reviewer) : '<span class="unknown">no reviewer</span>') + '</div>' + (r.blockers ? '<div class="small bad">' + r.blockers + ' launch blocker</div>' : '') + (r.drift ? '<div class="small warn">post-launch drift</div>' : '') + '</a>';
    }).join('') + '</div>';
  }).join('');
  var waiting = NS.reviews.filter(function (r) { return ['INTAKE', 'TRIAGE', 'DESIGN REVIEW'].indexOf(r.stage) >= 0; });
  var stats = [['Reviews waiting', waiting.length], ['Median review age', Math.round(P.quantile(NS.reviews.map(function (r) { return r.age; }), 0.5)) + ' d'], ['High-risk launches', NS.reviews.filter(function (r) { return r.risk === 'HIGH' && ['BUILD CHECK', 'LAUNCH GATE'].indexOf(r.stage) >= 0; }).length], ['Blocked launches', NS.reviews.filter(function (r) { return r.blockers; }).length], ['Post-launch drift', NS.reviews.filter(function (r) { return r.drift; }).length], ['Repeat findings', 3]];
  return P.pageHead('Privacy', 'Privacy review operating model', 'Intake → triage → design review → build check → launch gate → post-launch audit. <b>LOW</b> is self-service with automated checks; <b>MEDIUM</b> gets an expert review; <b>HIGH</b> gets a full threat model, engineering review and senior sign-off.') +
    '<div class="stat-row card" style="margin-bottom:14px">' + stats.map(function (x) { return '<div class="stat"><div class="sv">' + x[1] + '</div><div class="sl">' + x[0] + '</div></div>'; }).join('') + '</div>' +
    '<div class="kanban">' + cols + '</div>' +
    '<style>.kanban{display:grid;grid-template-columns:repeat(6,minmax(170px,1fr));gap:10px;overflow-x:auto;padding-bottom:6px}.kcol{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:8px;min-height:200px}.kh{display:flex;justify-content:space-between;padding:4px 4px 6px;border-bottom:1px solid var(--line)}.kc{display:block;text-decoration:none;color:var(--text);background:var(--panel);border:1px solid var(--line2);border-radius:10px;padding:10px}.kc:hover{border-color:var(--line3)}</style>';
} };
function workbench(fid) {
  var f = P.get(fid).obj, r = NS.reviews.filter(function (x) { return x.feature === fid; })[0], q = NS.eightQ[fid];
  var sys = NS.systems.filter(function (s) { return s.feature === fid; });
  var sysIds = sys.map(function (s) { return s.id; }).concat(NS.systems.filter(function (s) { return sys.some(function (p) { return s.parent === p.id; }); }).map(function (s) { return s.id; }));
  var ds = NS.datasets.filter(function (d) { return sysIds.indexOf(d.system) >= 0; });
  var flows = NS.flows.filter(function (x) { return sysIds.indexOf(x.from) >= 0 || sysIds.indexOf(x.to) >= 0; });
  var ids = P.uniq([].concat.apply([], ds.map(P.dsIds)));
  var vendors = P.uniq(flows.map(function (x) { return x.to; }).filter(function (t) { return P.get(t) && P.get(t).type === 'vendor'; }));
  var finds = NS.findings.filter(function (x) { return x.entities.indexOf(fid) >= 0 || x.entities.some(function (e) { return sysIds.indexOf(e) >= 0 || ds.some(function (d) { return d.id === e; }) || flows.some(function (fl) { return fl.id === e; }); }); });
  var lind = P.uniq([].concat.apply([], finds.map(function (x) { return x.linddun; })));
  var harms = P.uniq([].concat.apply([], finds.map(function (x) { return x.harms; })));
  var blockers = finds.filter(function (x) { return (x.sev === 'HIGH' && x.status !== 'accepted') || x.status === 'blocking launch'; });
  var openQ = []; if (q) Object.keys(q).forEach(function (k) { if (!q[k]) openQ.push('Question ' + k + ' has no answer yet — unknown, and therefore a finding.'); });
  ds.forEach(function (d) { P.six(d).why.forEach(function (w) { openQ.push(d.name + ': ' + w[1]); }); });
  var tc = []; ds.forEach(function (d) { P.tierControls(d).forEach(function (c) { if (c[1] !== true) tc.push('<b>' + esc(d.name) + '</b> — ' + esc(c[0])); }); });
  var QS = ['VALUE', 'DATA', 'IDENTITY', 'FLOW', 'ACCESS', 'TIME', 'MISUSE', 'REDUCE'];
  var RF = { VALUE: '“We might need it later.”', DATA: 'Free text, full URLs, raw payloads.', IDENTITY: 'A durable ID shared across features.', FLOW: 'Unlisted SDKs, logs, exports.', ACCESS: 'Warehouse-wide read by default.', TIME: 'No TTL, or “until deleted.”', MISUSE: 'Security data readable by ads.', REDUCE: 'Controls that live only in a doc.' };
  var diagram = miniDFD(sysIds, flows);
  return P.pageHead('Privacy · review workbench', f.name, chip(f.product) + ' · status ' + esc(f.status) + (r ? ' · review <span class="mono">' + r.id + '</span> ' + esc(r.stage) + ' ' + P.sev(r.risk) : ' · ' + unk('NO REVIEW'))) +
    (blockers.length ? '<div class="callout warn" style="margin-bottom:14px"><b>' + blockers.length + ' launch blocker' + (blockers.length > 1 ? 's' : '') + '.</b> ' + blockers.map(function (b) { return chip(b.id, b.id); }).join(' ') + ' — the launch gate refuses sign-off until these close.</div>' : '<div class="callout" style="margin-bottom:14px">No findings block launch.</div>') +
    '<div class="grid g-main"><div>' +
      '<div class="card" style="margin-bottom:14px"><div class="card-h"><h2 class="sec">Data-flow diagram (auto-built from lineage)</h2><span class="sub">' + flows.length + ' flows</span></div><div class="canvas">' + diagram + '</div></div>' +
      '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:10px">The universal 8-question review</h2><div class="tbl-wrap"><table class="tbl"><tbody>' + QS.map(function (k, i) { var a = q && q[k]; return '<tr><td class="nowrap"><span class="mono small dim">' + (i + 1) + '</span> <b>' + k + '</b></td><td>' + (q ? (a ? esc(a) : unk('UNKNOWN — this is a finding')) : unk('not yet answered')) + '<div class="small dim" style="margin-top:3px">Red flag: ' + esc(RF[k]) + '</div></td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="card"><h2 class="sec" style="margin-bottom:10px">Findings</h2>' + P.passportHelpers.findingsList(finds) + '</div>' +
    '</div><div>' +
      '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:8px">Data inventory</h2>' + (ds.length ? ds.map(function (d) { return '<div style="margin-bottom:8px">' + chip(d.id) + ' ' + P.tier(P.dsTier(d)) + P.sixStrip(P.six(d)) + '</div>'; }).join('') : '<p class="dim small">No datasets registered.</p>') + '</div>' +
      '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:8px">Identifiers · purposes · vendors</h2>' + P.kv([['Identifiers', ids.length ? P.chips(ids) : '—'], ['Purposes', P.chips(P.uniq([].concat.apply([], ds.map(function (d) { return d.purposes; })).concat(flows.map(function (x) { return x.purpose; })).filter(function (p) { return P.get(p); })))], ['Consent', P.uniq(ds.map(function (d) { return d.consent; })).map(esc).join('<br>')], ['Vendors', vendors.length ? P.chips(vendors) : 'none'], ['Retention', ds.map(function (d) { return esc(d.name) + ': ' + (d.retention.actual == null ? unk() : fmtDays(d.retention.actual) || 'source lifetime'); }).join('<br>')], ['Deletion', ds.map(function (d) { return esc(d.name) + ': ' + (d.deletionVerified ? '<span class="ok">verified</span>' : '<span class="bad">' + esc(d.deletion) + '</span>'); }).join('<br>')]]) + '</div>' +
      '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:8px">LINDDUN threats & harms</h2><div class="chips" style="margin-bottom:8px">' + ['Linking', 'Identifying', 'Non-repudiation', 'Detecting', 'Data disclosure', 'Unawareness', 'Non-compliance'].map(function (l) { return '<span class="tag' + (lind.indexOf(l) >= 0 ? ' sev-HIGH' : '') + '">' + l + '</span>'; }).join('') + '</div><div class="small muted">Harms: ' + (harms.join(' · ') || 'none identified') + '</div></div>' +
      '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:8px">Required controls (from tier defaults)</h2>' + (tc.length ? '<ul class="checks">' + tc.map(function (x) { return '<li><span class="ic bad">✗</span><span>' + x + '</span></li>'; }).join('') + '</ul>' : '<p class="ok small">All tier defaults met.</p>') + '</div>' +
      '<div class="card"><h2 class="sec" style="margin-bottom:8px">Open questions for the owner</h2>' + (openQ.length ? '<ol style="margin:0;padding-left:18px;font-size:13px">' + openQ.map(function (x) { return '<li style="margin:3px 0">' + esc(x) + '</li>'; }).join('') + '</ol>' : '<p class="small dim">None.</p>') + '</div>' +
    '</div></div>';
}
function miniDFD(sysIds, flows) {
  var nodes = P.uniq(flows.map(function (f) { return f.from; }).concat(flows.map(function (f) { return f.to; })).concat(sysIds));
  var lev = {}; nodes.forEach(function (n) { lev[n] = 0; });
  for (var k = 0; k < 6; k++) flows.forEach(function (f) { if (lev[f.to] <= lev[f.from]) lev[f.to] = lev[f.from] + 1; });
  var colsN = {}; nodes.forEach(function (n) { (colsN[lev[n]] = colsN[lev[n]] || []).push(n); });
  var maxC = Math.max.apply(null, Object.keys(colsN).map(Number)), maxR = Math.max.apply(null, Object.keys(colsN).map(function (c) { return colsN[c].length; }));
  var W = Math.max(560, (maxC + 1) * 180 + 20), H = maxR * 56 + 30, pos = {};
  Object.keys(colsN).forEach(function (c) { colsN[c].forEach(function (n, i) { pos[n] = [20 + c * 180, 20 + i * 56 + (maxR - colsN[c].length) * 28]; }); });
  var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Feature data-flow diagram">';
  flows.forEach(function (f) { var a = pos[f.from], b = pos[f.to]; if (!a || !b) return; var ax = a[0] + 150, ay = a[1] + 15, bx = b[0], by = b[1] + 15, mx = (ax + bx) / 2; if (b[0] <= a[0]) { bx = b[0] + 150; mx = ax + 40; } var c = f.status === 'unknown' ? '#6346c9' : (f.flags || []).indexOf('purpose_change') >= 0 ? '#946300' : f.boundary === 'third_party' ? '#c0470f' : '#9aa1ac'; s += '<g class="edge" data-ent="' + f.id + '" tabindex="0" role="button" aria-label="' + esc(P.name(f.id)) + '"><path class="hit" d="M' + ax + ',' + ay + ' C' + mx + ',' + ay + ' ' + mx + ',' + by + ' ' + bx + ',' + by + '"/><path class="vis" d="M' + ax + ',' + ay + ' C' + mx + ',' + ay + ' ' + mx + ',' + by + ' ' + bx + ',' + by + '" fill="none" stroke="' + c + '" stroke-width="' + (1 + f.tier * 0.5) + '"' + (f.status !== 'reviewed' ? ' stroke-dasharray="5 4"' : '') + '/></g>'; });
  nodes.forEach(function (n) { var p = pos[n], e = P.get(n); if (!e) return; var tp = e.type, col = tp === 'vendor' || tp === 'subprocessor' ? '#c0470f' : tp === 'model' ? '#963bbd' : '#4f78a8'; var l = P.name(n); if (l.length > 21) l = l.slice(0, 20) + '…'; s += '<g class="node" data-ent="' + n + '" tabindex="0" role="button" aria-label="' + esc(P.name(n)) + '"><rect x="' + p[0] + '" y="' + p[1] + '" width="150" height="30" rx="8" fill="#fffdf9" stroke="#d3cbbb"/><rect x="' + p[0] + '" y="' + p[1] + '" width="3.5" height="30" rx="2" fill="' + col + '"/><text x="' + (p[0] + 10) + '" y="' + (p[1] + 19) + '" fill="#1d2430" font-size="11">' + esc(l) + '</text></g>'; });
  return s + '</svg>';
}
P.miniDFD = miniDFD;

/* ════════════ CONSENT ════════════ */
V['privacy/consent'] = { title: 'Consent', render: function () {
  var cs = NS.consentConsumers, live = cs.filter(function (c) { return c.p50 != null; });
  var p50 = P.quantile(live.map(function (c) { return c.p50; }), 0.5), p95 = P.quantile(live.map(function (c) { return c.p95; }), 0.95), p99 = Math.max.apply(null, live.map(function (c) { return c.p99; }));
  var never = cs.filter(function (c) { return c.p50 == null; }), stale = never.reduce(function (s, c) { return s + c.stale; }, 0);
  var W = 760, rowH = 30, H = cs.length * rowH + 40, x0 = 230, xs = function (v) { return x0 + (Math.log10(Math.max(v, 0.05)) + 1.4) / (6.2 + 1.4) * (W - x0 - 60); };
  var s = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Consent propagation latency per consumer">';
  [[0.1, '100 ms'], [1, '1 s'], [60, '1 min'], [3600, '1 h'], [86400, '1 d'], [604800, '7 d']].forEach(function (t) { var x = xs(t[0]); s += '<line x1="' + x + '" x2="' + x + '" y1="10" y2="' + (H - 24) + '" stroke="#e7e1d5"/><text x="' + x + '" y="' + (H - 8) + '" fill="#6b6457" font-size="10" text-anchor="middle">' + t[1] + '</text>'; });
  cs.forEach(function (c, i) {
    var y = 20 + i * rowH;
    s += '<g class="node" data-ent="' + c.id + '" tabindex="0" role="button" aria-label="' + esc(c.name) + '"><text x="' + (x0 - 10) + '" y="' + (y + 4) + '" fill="' + (c.p50 == null ? '#c0470f' : '#3a4250') + '" font-size="11.5" text-anchor="end">' + esc(c.name) + '</text>';
    if (c.p50 == null) s += '<line x1="' + x0 + '" x2="' + (W - 60) + '" y1="' + y + '" y2="' + y + '" stroke="#c0470f" stroke-dasharray="3 4" stroke-opacity=".6"/><text x="' + (W - 56) + '" y="' + (y + 4) + '" fill="#c0470f" font-size="10.5">never · ' + esc(c.mode) + '</text>';
    else s += '<line x1="' + xs(c.p50) + '" x2="' + xs(c.p99) + '" y1="' + y + '" y2="' + y + '" stroke="#0b7d60" stroke-opacity=".5" stroke-width="2"/><circle cx="' + xs(c.p95) + '" cy="' + y + '" r="3" fill="none" stroke="#0b7d60"/><circle cx="' + xs(c.p50) + '" cy="' + y + '" r="5" fill="#0b7d60"/><text x="' + (xs(c.p99) + 8) + '" y="' + (y + 4) + '" fill="#6b6457" font-size="10">' + esc(c.mode) + '</text>';
    s += '</g>';
  });
  s += '</svg>';
  var steps = [['Collection stops', 'cc1'], ['API reads stop', 'cc3'], ['Warehouse reads stop', 'cc5'], ['Scheduled jobs receive the update', 'cc7'], ['Cached consent expires', 'cc4'], ['Derived data handled', 'cc10'], ['ML features updated', 'cc14'], ['Vendors notified', 'cc11'], ['Audit evidence generated', null]];
  return P.pageHead('Privacy', 'Consent command center', 'Consent is <b>state</b>, not a checkbox: who, purpose, scope, source, timestamp, expiry, version, jurisdiction. Every state change must reach every copy — including the ones in flight.') +
    '<div class="grid g-main" style="margin-bottom:14px"><div class="card"><div class="card-h"><h2 class="sec">Consent propagation latency</h2><span class="sub">dot P50 · ring P95 · bar to P99 · log scale</span></div>' + s + '</div>' +
    '<div class="card"><div class="stat-row" style="margin-bottom:12px"><div class="stat"><div class="sv">' + P.fmtSecs(p50) + '</div><div class="sl">P50</div></div><div class="stat"><div class="sv">' + P.fmtSecs(p95) + '</div><div class="sl">P95</div></div><div class="stat"><div class="sv">' + P.fmtSecs(p99) + '</div><div class="sl">P99</div></div><div class="stat"><div class="sv bad">' + never.length + '</div><div class="sl">never receive it</div></div></div>' +
    '<p class="small dim mono" style="margin:0 0 12px">P50 = median of consumer P50s; P95 = 95th percentile of consumer P95s; P99 = worst consumer P99 — over the ' + live.length + ' consumers that propagate at all.</p>' +
    '<div class="callout warn"><b>' + fmtN(stale) + ' people</b> are being processed on stale consent by ' + never.length + ' consumers.</div>' + stateMachine() + '</div></div>' +
    '<div class="card"><div class="card-h"><h2 class="sec">Simulate a revocation</h2><button class="btn danger" id="revoke">Revoke advertising consent for one person</button></div><ul class="checks" id="revSteps">' + steps.map(function (st, i) { return '<li data-i="' + i + '"><span class="ic dim">·</span><span>' + esc(st[0]) + (st[1] ? ' <span class="small dim">— ' + esc(P.name(st[1])) + '</span>' : '') + '</span></li>'; }).join('') + '</ul></div>';
}, mount: function (root) {
  var steps = [['cc1'], ['cc3'], ['cc5'], ['cc7'], ['cc4'], ['cc10'], ['cc14'], ['cc11'], [null]];
  root.querySelector('#revoke').addEventListener('click', function () {
    var btn = this; btn.disabled = true;
    var lis = root.querySelectorAll('#revSteps li');
    lis.forEach(function (li, i) {
      setTimeout(function () {
        var c = steps[i][0] ? P.get(steps[i][0]).obj : null, ok = c ? c.p50 != null : true, slow = c && c.p50 != null && c.p50 > 3600;
        var ic = li.querySelector('.ic'); ic.className = 'ic ' + (ok ? (slow ? 'warn' : 'ok') : 'bad'); ic.textContent = ok ? (slow ? '~' : '✓') : '✗';
        li.lastChild.insertAdjacentHTML('beforeend', ' <span class="small ' + (ok ? (slow ? 'warn' : 'ok') : 'bad') + '">' + (c ? (ok ? 'after ' + P.fmtSecs(c.p50) + ' (P50)' : 'NEVER — ' + esc(c.mode)) : 'receipt written') + '</span>');
        if (i === lis.length - 1) btn.disabled = false;
      }, 380 * (i + 1));
    });
  });
} };
function stateMachine() {
  return '<svg viewBox="0 0 420 170" width="100%" style="margin-top:12px" role="group" aria-label="Consent state machine: unknown, granted, revoked, expired"><defs><marker id="smA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6b6457"/></marker></defs>' +
    [['UNKNOWN', 20, 70, '#6346c9'], ['GRANTED', 160, 20, '#0b7d60'], ['REVOKED', 300, 70, '#c0470f'], ['EXPIRED', 160, 120, '#946300']].map(function (n) { return '<rect x="' + n[1] + '" y="' + n[2] + '" width="100" height="30" rx="15" fill="#fffdf9" stroke="' + n[3] + '"' + (n[0] === 'UNKNOWN' ? ' stroke-dasharray="4 3"' : '') + '/><text x="' + (n[1] + 50) + '" y="' + (n[2] + 19) + '" fill="' + n[3] + '" font-size="11" font-weight="700" text-anchor="middle" font-family="JetBrains Mono">' + n[0] + '</text>'; }).join('') +
    '<path d="M120,78 L160,42" stroke="#6b6457" marker-end="url(#smA)"/><text x="104" y="52" fill="#6b6457" font-size="9">opt in</text>' +
    '<path d="M260,40 L300,72" stroke="#6b6457" marker-end="url(#smA)"/><text x="284" y="48" fill="#6b6457" font-size="9">revoke</text>' +
    '<path d="M300,94 C260,110 250,40 262,36" fill="none" stroke="#6b6457" stroke-dasharray="3 3" marker-end="url(#smA)"/><text x="232" y="92" fill="#6b6457" font-size="9">re-consent</text>' +
    '<path d="M210,50 L210,118" stroke="#6b6457" marker-end="url(#smA)"/><text x="214" y="88" fill="#6b6457" font-size="9">scope ends</text>' +
    '<path d="M160,135 C110,150 90,110 170,52" fill="none" stroke="#6b6457" stroke-dasharray="3 3" marker-end="url(#smA)"/><text x="72" y="150" fill="#6b6457" font-size="9">re-prompt</text>' +
    '<text x="20" y="118" fill="#6b6457" font-size="9">default = no processing</text></svg>';
}

/* ════════════ PURPOSE LIMITATION ════════════ */
V['privacy/purpose'] = { title: 'Purpose', render: function () {
  var cases = [
    { field: 'phone_number', ds: 'd_phone2fa', orig: 'account_security', uses: [['login verification', true], ['account recovery', true], ['advertising audience (phone_hash match)', false, 'PRV-0203'], ['unrelated model training', false]] },
    { field: 'device_fingerprint · fraud_score_band', ds: 'd_fraudfeat', orig: 'fraud_prevention', uses: [['real-time fraud scoring', true], ['fraud model training', true], ['Marketing Audience Builder', false, 'PRV-0217'], ['Lookalike model features', false, 'PRV-0217']] },
    { field: 'home_cluster · work_cluster', ds: 'd_lochist', orig: 'service_delivery', uses: [['nearest pickup point', true], ['audience segments', false, 'PRV-0208']] },
    { field: 'prompt_text', ds: 'd_prompts', orig: 'service_delivery', uses: [['answer the question', true], ['debugging (30 d)', true], ['fine-tuning set', false, 'PRV-0212']] },
    { field: 'transcript', ds: 'd_transcripts', orig: 'customer_support', uses: [['resolve the case', true], ['agent training', true], ['third-party summariser (LLMCo)', null, 'PRV-0237']] },
    { field: 'pulse screen views', ds: 'd_pulseinstall', orig: 'analytics', uses: [['crash analytics', true], ['advertising warehouse', false, 'PRV-0233']] }
  ];
  var mat = NS.datasets.filter(function (d) { return P.dsTier(d) >= 2; });
  var ps = NS.purposes;
  var useMap = {}; NS.flows.forEach(function (f) { var d = NS.datasets.filter(function (x) { return x.system === f.from; }); d.forEach(function (x) { (useMap[x.id] = useMap[x.id] || {})[f.purpose] = f; }); });
  var grid = '<div class="tbl-wrap"><table class="tbl pm"><thead><tr><th>Dataset</th>' + ps.map(function (p) { return '<th class="rot"><span>' + esc(p.id) + '</span></th>'; }).join('') + '</tr></thead><tbody>' + mat.map(function (d) {
    return '<tr><td>' + chip(d.id) + '</td>' + ps.map(function (p) { var dec = d.purposes.indexOf(p.id) >= 0, used = useMap[d.id] && useMap[d.id][p.id]; var cls = dec && used ? 'ok' : dec ? 'dec' : used ? 'drift' : ''; return '<td class="pc ' + cls + '"' + (used ? ' data-ent="' + used.id + '" role="button" tabindex="0"' : '') + ' title="' + (dec ? 'declared' : '') + (used ? ' · used by ' + esc(P.name(used.id)) : '') + '">' + (dec && used ? '●' : dec ? '○' : used ? '✗' : '') + '</td>'; }).join('') + '</tr>';
  }).join('') + '</tbody></table></div>';
  return P.pageHead('Privacy', 'Purpose limitation engine', 'Data carries its purpose with it, and every new use has to show its ticket. Purpose is evaluated when data is <b>used</b>, not merely when it is collected.') +
    '<div class="grid g3" style="margin-bottom:14px">' + cases.map(function (c) {
      var drift = c.uses.some(function (u) { return u[1] === false; });
      return '<div class="card"><div class="mono" style="font-size:13px">' + esc(c.field) + '</div><div class="small dim" style="margin:4px 0 10px">ORIGINAL PURPOSE <span class="tag sev-GOOD">' + esc(c.orig) + '</span></div><div class="small dim" style="margin-bottom:4px">CURRENT USES</div><ul class="checks">' + c.uses.map(function (u) { return P.check(u[1], esc(u[0]) + (u[2] ? ' ' + chip(u[2], u[2]) : '')); }).join('') + '</ul>' + (drift ? '<div class="tag sev-HIGH" style="margin-top:10px">PURPOSE DRIFT DETECTED</div>' : '') + '<div style="margin-top:8px">' + chip(c.ds) + '</div></div>';
    }).join('') + '</div>' +
    '<div class="card"><div class="card-h"><h2 class="sec">Declared vs actual use</h2><span class="sub">○ declared · ● declared and used · <span class="bad">✗ used without declaration</span></span></div>' + grid + '</div>' +
    '<div class="callout" style="margin-top:14px">Four questions for every new use: What did the person understand? What was the original purpose (in metadata, not memory)? Did the purpose change — a new purpose needs a new basis? Can they revoke, and does revocation reach every copy? Enforcement today: ' + chip('c_purpose_runtime') + ' runs at query time for Pulse only; everywhere else it is ' + chip('c_purpose_fs') + ' — a human approval.</div>' +
    '<style>.pm th.rot{height:120px;vertical-align:bottom;padding:4px}.pm th.rot span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px}.pm td.pc{text-align:center;font-size:13px;min-width:30px}.pm td.pc.ok{color:var(--ctl)}.pm td.pc.dec{color:var(--dim)}.pm td.pc.drift{color:var(--exp);background:rgba(192,71,15,.12);cursor:pointer;font-weight:700}</style>';
} };

/* ════════════ RETENTION OBSERVATORY ════════════ */
var CLASSES = { raw: ['d_purchase', 'd_lochist', 'd_browse', 'd_txn', 'd_family', 'd_profile', 'd_phone2fa', 'd_pulsecycle'], derived: ['d_fraudfeat', 'd_audience', 'd_orders_wh', 'd_heart'], aggregates: ['d_dpstats'], logs: ['d_applogs', 'd_linklogs', 'd_prompts'], backups: ['d_backup'], events: ['d_adsevents', 'd_pulseinstall'], 'ML & training': ['d_novavec', 'd_novamem', 'd_transcripts', 'd_identity_graph', 'd_search', 'd_msgmeta'] };
V['privacy/retention'] = { title: 'Retention', render: function () {
  var W = 780, x0 = 210, xs = function (d) { return x0 + Math.log10(Math.max(d, 1)) / Math.log10(4000) * (W - x0 - 30); };
  var rows = []; Object.keys(CLASSES).forEach(function (c) { rows.push(['h', c]); CLASSES[c].forEach(function (id) { rows.push(['d', id]); }); });
  var H = rows.length * 22 + 40, y = 16;
  var s = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Required versus actual retention per dataset, log scale">';
  [[1, '1 d'], [7, '1 wk'], [30, '30 d'], [90, '90 d'], [365, '1 yr'], [1095, '3 yr'], [3650, '10 yr']].forEach(function (t) { var x = xs(t[0]); s += '<line x1="' + x + '" x2="' + x + '" y1="10" y2="' + (H - 22) + '" stroke="#e7e1d5"/><text x="' + x + '" y="' + (H - 6) + '" fill="#6b6457" font-size="10" text-anchor="middle">' + t[1] + '</text>'; });
  rows.forEach(function (r) {
    if (r[0] === 'h') { s += '<text x="8" y="' + (y + 12) + '" fill="#6b6457" font-size="10" font-family="JetBrains Mono" letter-spacing="1">' + esc(r[1].toUpperCase()) + '</text>'; y += 22; return; }
    var d = P.get(r[1]).obj, rt = d.retention, cy = y + 8;
    s += '<g class="node" data-ent="' + d.id + '" tabindex="0" role="button" aria-label="' + esc(d.name) + '"><text x="' + (x0 - 10) + '" y="' + (cy + 4) + '" fill="#3a4250" font-size="11" text-anchor="end">' + esc(d.name.slice(0, 28)) + '</text>';
    if (rt.actual == null) s += '<rect x="' + x0 + '" y="' + (cy - 5) + '" width="' + (W - x0 - 30) + '" height="10" rx="5" fill="none" stroke="#6346c9" stroke-dasharray="4 3"/><text x="' + (x0 + 8) + '" y="' + (cy + 4) + '" fill="#6346c9" font-size="10">UNKNOWN RETENTION</text>';
    else if (rt.actual === 0) s += '<text x="' + x0 + '" y="' + (cy + 4) + '" fill="#6b6457" font-size="10">' + esc(rt.note || 'source lifetime') + '</text>';
    else {
      var over = rt.required > 0 && rt.actual > rt.required;
      if (rt.required > 0) s += '<line x1="' + xs(rt.required) + '" x2="' + xs(rt.actual) + '" y1="' + cy + '" y2="' + cy + '" stroke="' + (over ? '#c0470f' : '#0b7d60') + '" stroke-width="3" stroke-opacity=".5"/><line x1="' + xs(rt.required) + '" x2="' + xs(rt.required) + '" y1="' + (cy - 7) + '" y2="' + (cy + 7) + '" stroke="#0b7d60" stroke-width="2"/>';
      s += '<circle cx="' + xs(rt.actual) + '" cy="' + cy + '" r="5" fill="' + (over ? '#c0470f' : '#0b7d60') + '"' + (rt.ttl ? '' : ' stroke="#1d2430" stroke-dasharray="2 2"') + '/>';
      if (rt.required == null) s += '<text x="' + (xs(rt.actual) + 9) + '" y="' + (cy + 4) + '" fill="#6346c9" font-size="10">no requirement</text>';
      else if (over) s += '<text x="' + (xs(rt.actual) + 9) + '" y="' + (cy + 4) + '" fill="#c0470f" font-size="10">' + Math.round(rt.actual / rt.required) + '× need</text>';
    }
    s += '</g>'; y += 22;
  });
  s += '</svg>';
  var det = [];
  NS.datasets.forEach(function (d) {
    var r = d.retention;
    if (r.actual == null || r.required == null && r.note == null) det.push(['UNKNOWN RETENTION', d.id]);
    if (!r.ttl && r.note == null && r.actual != null) det.push(['NO TTL', d.id]);
    if (r.required > 0 && r.actual > r.required) det.push(['TTL DRIFT', d.id]);
    if (/raw|table|topic|stream/.test(d.kind) && r.actual > 180 && CLASSES.raw.indexOf(d.id) >= 0 && r.actual > r.required) det.push(['RAW DATA TOO OLD', d.id]);
    if (!d.owner) det.push(['ORPHANED DATA', d.id]);
    if (d.kind === 'log' && r.actual > 30 && d.fields.some(function (f) { return f[1] >= 2 && f[2] !== 'attr' || /url|prompt/.test(f[0]); })) det.push(['PII IN LONG-LIVED LOGS', d.id]);
  });
  NS.vendors.forEach(function (v) { if (v.retention.contract != null && v.retention.actual > v.retention.contract) det.push(['VENDOR RETENTION MISMATCH', v.id]); });
  det.push(['BACKUP VIOLATIONS', null]);
  var groups = {}; det.forEach(function (x) { (groups[x[0]] = groups[x[0]] || []).push(x[1]); });
  return P.pageHead('Privacy', 'Retention observatory', 'Retention is a risk multiplier: every extra day is another day for breach, subpoena, misuse, inference and scope creep. Raw, derived, aggregate, logs, backups, events and ML data are tracked separately.') +
    '<div class="q-line"><strong>After the decision is made, do we still need the raw event?</strong> Raw events: keep days, not years. Derived features: keep what the decision needs. Aggregates: keep, with identifiers expired.</div>' +
    '<div class="grid g-main"><div class="card"><div class="card-h"><h2 class="sec">Required vs actual</h2><span class="sub">teal tick = required · dot = oldest record · dashed dot = no TTL</span></div>' + s + '</div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:10px">Detections</h2>' + Object.keys(groups).map(function (g) { var ids = groups[g].filter(Boolean); return '<div style="margin-bottom:10px"><div class="card-h" style="margin-bottom:4px"><span class="mono small ' + (/UNKNOWN|ORPHAN/.test(g) ? 'unknown' : ids.length ? 'bad' : 'ok') + '" style="border:0">' + g + '</span><span class="mono small">' + ids.length + '</span></div>' + (ids.length ? P.chips(ids) : '<span class="small ok">none — backups expire at 35 d and deletions re-apply on restore</span>') + '</div>'; }).join('') + '</div></div>';
} };

/* ════════════ FORGET ME ════════════ */
V['privacy/deletion'] = { title: 'Forget Me', render: function () {
  var T = NS.deletionTargets, n = T.length, v = T.filter(function (t) { return t[3] === 'verified'; }).length;
  return P.pageHead('Privacy · the real burn button', 'Forget me', 'Design every system as if “Forget me” had to work. One request fans out to every place the data was ever copied — primary, replicas, caches, streams, warehouse, logs, indexes, backups, feature stores, models, CRM, vendors. Miss one and the promise breaks.') +
    '<div class="grid g-main"><div class="card"><div class="canvas" id="fmCanvas" style="background:var(--bg2);border:0"></div></div>' +
    '<div class="card"><div class="forget"><button class="forget-btn" id="fmBtn">Forget me</button><div class="small muted">Simulates one person\'s deletion across Northstar</div></div>' +
    '<div class="stat-row" style="justify-content:center;margin:16px 0" id="fmStats"><div class="stat"><div class="sv">' + n + '</div><div class="sl">systems discovered</div></div><div class="stat"><div class="sv ok">' + P.pct(v, n) + '%</div><div class="sl">verified deletion coverage</div></div></div>' +
    '<div id="fmLog" class="small"></div>' +
    '<div class="callout unk" style="margin-top:12px"><b>+1 copy the orchestrator does not know about:</b> the purchase-events dead-letter queue holds 41 days of payloads. If deletion cannot be proven, the uncertainty is a finding.</div>' +
    '<div class="small muted" style="margin-top:12px">Mechanisms in use: tombstones · hard delete · soft-delete expiry · crypto-shredding · cache invalidation · vendor deletion API · attestation · retries · verification scan (canary IDs re-queried at T+72h).</div></div></div>';
}, mount: function (root) {
  var T = NS.deletionTargets, el = root.querySelector('#fmCanvas'), W = 640, H = 560, cx = W / 2, cy = H / 2, R = 225;
  var col = { verified: '#0b7d60', waiting: '#946300', failed: '#c0470f', unknown: '#6346c9' };
  function draw(state) {
    var s = '<svg viewBox="-70 0 ' + (W + 140) + ' ' + H + '" width="100%" style="max-width:' + (W + 140) + 'px;display:block;margin:auto" role="group" aria-label="Deletion fan-out to ' + T.length + ' systems">';
    T.forEach(function (t, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / T.length, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a), st = state[i], c = st ? col[st] : '#d3cbbb';
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + c + '" stroke-opacity="' + (st ? 0.55 : 0.25) + '"' + (st === 'unknown' ? ' stroke-dasharray="4 3"' : '') + (st === 'pending' ? ' class="flowdash" stroke-dasharray="4 4"' : '') + '/>';
      var anchor = Math.cos(a) > 0.15 ? 'start' : Math.cos(a) < -0.15 ? 'end' : 'middle', dx = anchor === 'start' ? 11 : anchor === 'end' ? -11 : 0, dy = anchor === 'middle' ? (Math.sin(a) > 0 ? 20 : -12) : 4;
      s += '<g class="node" data-ent="' + t[0] + '" tabindex="0" role="button" aria-label="' + esc(t[1] + ': ' + (st || 'not started')) + '"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7" fill="' + (st && st !== 'pending' ? c : '#f6f3ec') + '" stroke="' + c + '"' + (st === 'unknown' ? ' fill-opacity="0" stroke-dasharray="2 2"' : '') + '/><text x="' + (x + dx).toFixed(1) + '" y="' + (y + dy).toFixed(1) + '" fill="#3a4250" font-size="10" text-anchor="' + anchor + '">' + esc(t[1]) + '</text></g>';
    });
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="52" fill="#f6f3ec" stroke="#b9b1a0"/><text x="' + cx + '" y="' + (cy - 4) + '" fill="#1d2430" font-size="11" font-weight="700" text-anchor="middle">DELETION</text><text x="' + cx + '" y="' + (cy + 11) + '" fill="#1d2430" font-size="11" font-weight="700" text-anchor="middle">ORCHESTRATOR</text>';
    el.innerHTML = s + '</svg>';
  }
  var init = T.map(function () { return null; }); draw(init);
  root.querySelector('#fmBtn').addEventListener('click', function () {
    var btn = this; btn.disabled = true;
    var state = T.map(function () { return 'pending'; }); draw(state);
    var log = root.querySelector('#fmLog'); log.innerHTML = '<div class="mono dim">DELETE REQUEST → DELETION ORCHESTRATOR · ' + T.length + ' systems discovered</div>';
    var order = T.map(function (t, i) { return i; }).sort(function (a, b) { var r = { verified: 0, waiting: 1, failed: 2, unknown: 3 }; return r[T[a][3]] - r[T[b][3]] || a - b; });
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    order.forEach(function (i, k) {
      setTimeout(function () {
        state[i] = T[i][3]; draw(state);
        if (T[i][3] !== 'verified') log.insertAdjacentHTML('beforeend', '<div><span class="' + (T[i][3] === 'waiting' ? 'warn' : T[i][3] === 'unknown' ? 'unknown' : 'bad') + '" style="border:0">' + T[i][3].toUpperCase() + '</span> ' + esc(T[i][1]) + ' — ' + esc(T[i][2]) + '</div>');
        if (k === order.length - 1) {
          var c = {}; T.forEach(function (t) { c[t[3]] = (c[t[3]] || 0) + 1; });
          root.querySelector('#fmStats').innerHTML = [['verified', 'ok'], ['waiting', 'warn'], ['failed', 'bad'], ['unknown', 'unknown']].map(function (x) { return '<div class="stat"><div class="sv ' + x[1] + '" style="border:0">' + (c[x[0]] || 0) + '</div><div class="sl">' + x[0] + (x[0] === 'waiting' ? ' (vendor)' : '') + '</div></div>'; }).join('') + '<div class="stat"><div class="sv">' + P.pct(c.verified, T.length) + '%</div><div class="sl">verified coverage</div></div>';
          btn.disabled = false;
        }
      }, reduce ? 0 : 140 * (k + 1));
    });
  });
} };

/* ════════════ USER RIGHTS ════════════ */
function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
P.rightsRequests = (function () {
  var r = rng(42), out = [], regs = ['EU', 'CA', 'UK', 'BR', 'US-other'], delaySys = ['v_helphub', 'v_adreach', 's_idres', 's_logs', 's_wh', 's_novalogs'];
  for (var i = 0; i < 64; i++) {
    var type = NS.rightsTypes[Math.floor(r() * NS.rightsTypes.length)], reg = regs[Math.floor(r() * regs.length)], open = Math.floor(r() * 60);
    var sla = reg === 'EU' || reg === 'UK' ? 30 : reg === 'BR' ? 15 : 45;
    var done = r() > 0.28, took = Math.round(2 + Math.pow(r(), 2.2) * 50), delay = took > 14 ? delaySys[Math.floor(r() * delaySys.length)] : null;
    out.push({ id: 'DSR-' + (4100 + i), type: type, region: reg, age: open, sla: sla, done: done, took: done ? took : null, delay: delay, verified: done && r() > 0.2, idv: r() > 0.05 ? 'passed' : 'failed' });
  }
  return out;
})();
V['privacy/rights'] = { title: 'User Rights', render: function () {
  var R = P.rightsRequests, open = R.filter(function (x) { return !x.done; }), done = R.filter(function (x) { return x.done; });
  var med = P.quantile(done.map(function (x) { return x.took; }), 0.5), p95 = P.quantile(done.map(function (x) { return x.took; }), 0.95);
  var slaFail = R.filter(function (x) { return (x.done ? x.took : x.age) > x.sla; }).length;
  var delay = {}; R.forEach(function (x) { if (x.delay) delay[x.delay] = (delay[x.delay] || 0) + 1; });
  var maxD = Math.max.apply(null, Object.keys(delay).map(function (k) { return delay[k]; }));
  var hist = []; for (var b = 0; b < 11; b++) hist.push(done.filter(function (x) { return Math.min(10, Math.floor(x.took / 5)) === b; }).length);
  var hmax = Math.max.apply(null, hist);
  return P.pageHead('Privacy', 'User rights operations', 'Access · delete · correct · port · opt out · object · limit sensitive use. Every right is a system requirement in disguise; the hard prerequisite behind all of them is lineage — you cannot delete what you cannot find.') +
    '<div class="stat-row card" style="margin-bottom:14px">' + [['Open requests', open.length], ['Median completion', Math.round(med) + ' d'], ['P95 completion', Math.round(p95) + ' d'], ['SLA failures', slaFail], ['Verification failures', done.filter(function (x) { return !x.verified; }).length], ['Identity checks failed', R.filter(function (x) { return x.idv === 'failed'; }).length]].map(function (x, i) { return '<div class="stat"><div class="sv' + (i === 3 || i === 4 ? ' bad' : '') + '">' + x[1] + '</div><div class="sl">' + x[0] + '</div></div>'; }).join('') + '</div>' +
    '<div class="grid g2" style="margin-bottom:14px"><div class="card"><h2 class="sec" style="margin-bottom:10px">Completion time (days)</h2><div class="hist">' + hist.map(function (h, i) { return '<div class="hb" title="' + (i * 5) + '–' + (i * 5 + 4) + ' d: ' + h + '"><span style="height:' + (h / hmax * 100) + '%;background:' + (i * 5 >= 30 ? 'var(--exp)' : 'var(--info)') + '"></span><em>' + (i === 10 ? '50+' : i * 5) + '</em></div>'; }).join('') + '</div><p class="small dim">Coral bars exceed the strictest 30-day deadline.</p></div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:10px">Systems causing delay</h2><div class="bars">' + Object.keys(delay).sort(function (a, b) { return delay[b] - delay[a]; }).map(function (k) { return '<div class="br"><span>' + chip(k) + '</span><span class="track"><span class="fill" style="width:' + (delay[k] / maxD * 100) + '%;background:' + (P.get(k).type === 'vendor' ? 'var(--exp)' : 'var(--med)') + '"></span></span><span class="mono small" style="text-align:right">' + delay[k] + '</span></div>'; }).join('') + '</div><p class="small dim">Vendors in coral: vendor delays are the largest single cause.</p></div></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Request</th><th>Right</th><th>Region</th><th>Identity</th><th class="num">Age / took</th><th class="num">Deadline</th><th>Status</th><th>Delayed by</th></tr></thead><tbody>' + R.slice(0, 24).map(function (x) { var t = x.done ? x.took : x.age, late = t > x.sla; return '<tr><td class="mono small">' + x.id + '</td><td>' + esc(x.type) + '</td><td class="mono small">' + esc(x.region) + '</td><td class="small ' + (x.idv === 'failed' ? 'bad' : 'dim') + '">' + x.idv + '</td><td class="num ' + (late ? 'bad' : '') + '">' + t + ' d</td><td class="num">' + x.sla + ' d</td><td>' + (x.done ? (x.verified ? '<span class="ok">complete · verified</span>' : '<span class="warn">complete · unverified</span>') : '<span class="dim">open</span>') + '</td><td>' + (x.delay ? chip(x.delay) : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<style>.hist{display:grid;grid-template-columns:repeat(11,1fr);gap:4px;height:150px;align-items:end}.hb{display:flex;flex-direction:column;justify-content:flex-end;height:100%;text-align:center}.hb span{display:block;border-radius:4px 4px 0 0;min-height:2px}.hb em{font:10px var(--mono);color:var(--dim);font-style:normal;margin-top:4px}</style>';
} };

/* ════════════ TRACKING OBSERVATORY ════════════ */
V['privacy/tracking'] = { title: 'Tracking', render: function () {
  var T = NS.trackers, pages = NS.trackPages;
  var heat = '<div class="tbl-wrap"><table class="tbl th"><thead><tr><th>Page / app</th><th>Context</th>' + T.map(function (t) { return '<th class="rot"><span>' + esc(t.name.slice(0, 22)) + '</span></th>'; }).join('') + '</tr></thead><tbody>' + pages.map(function (p) {
    var sens = /authenticated|health|children|financial/.test(p.ctx);
    return '<tr><td>' + esc(p.page) + '</td><td class="small ' + (sens ? 'warn' : 'dim') + '">' + esc(p.ctx) + '</td>' + T.map(function (t) { var on = p.trackers.indexOf(t.id) >= 0, bad = on && sens && t.party !== 'first'; var badish = on && sens && (t.flags.length); return '<td class="tc' + (bad ? ' b' : badish ? ' m' : on ? ' o' : '') + '"' + (on ? ' data-ent="' + t.id + '" role="button" tabindex="0"' : '') + '>' + (on ? '●' : '') + '</td>'; }).join('') + '</tr>';
  }).join('') + '</tbody></table></div>';
  var flagsAll = {}; T.forEach(function (t) { t.flags.forEach(function (f) { (flagsAll[f] = flagsAll[f] || []).push(t.id); }); });
  NS.trackPages.forEach(function (p) { if (/children/.test(p.ctx) && p.trackers.length) (flagsAll['tracking in children\'s context'] = flagsAll['tracking in children\'s context'] || []).push(p.trackers[0]); });
  return P.pageHead('Privacy', 'Web & mobile tracking observatory', 'Cookies, storage, advertising IDs, pixels, SDKs, fingerprinting, link decoration, CNAME cloaking, email pixels, server-side forwarding. The pixel or SDK usually behaves exactly as designed; what fails is a review that never asked where the events went.') +
    '<div class="grid g-main" style="margin-bottom:14px"><div class="card"><div class="card-h"><h2 class="sec">Where each tracker fires</h2><span class="sub"><span class="bad">●</span> third party on a sensitive page · <span class="warn">●</span> flagged tracker on a sensitive page</span></div>' + heat + '</div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:10px">Flags</h2>' + Object.keys(flagsAll).map(function (f) { return '<div style="margin-bottom:8px"><div class="small bad mono">' + esc(f.toUpperCase()) + '</div>' + P.chips(flagsAll[f]) + '</div>'; }).join('') + '</div></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tracker</th><th>Kind</th><th>Domain</th><th>Party</th><th>Purpose</th><th>Identifier</th><th>Lifespan</th><th>Fields</th><th>Consent</th><th>Review</th></tr></thead><tbody>' + T.map(function (t) { return '<tr class="click" data-ent="' + t.id + '" tabindex="0"><td><b>' + esc(t.name) + '</b><div class="small dim">' + esc(t.company) + '</div></td><td class="small">' + esc(t.kind) + '</td><td class="mono small">' + esc(t.domain) + '</td><td class="small">' + esc(t.party) + '</td><td class="small">' + (t.purpose === 'unknown' ? unk() : esc(t.purpose)) + '</td><td>' + (t.identifier ? chip(t.identifier) : '—') + '</td><td class="small">' + (/unknown/.test(t.lifespan) ? unk() : esc(t.lifespan)) + '</td><td class="small">' + esc(t.fields) + '</td><td class="small">' + esc(t.consent) + '</td><td>' + (t.review === 'reviewed' ? '<span class="small ok">reviewed</span>' : '<span class="tag sev-HIGH">unreviewed</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<style>.th th.rot{height:130px;vertical-align:bottom;padding:4px}.th th.rot span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px}.th td.tc{text-align:center;min-width:24px;color:var(--dim)}.th td.tc.o{color:var(--info);cursor:pointer}.th td.tc.m{color:var(--med);background:rgba(148,99,0,.1);cursor:pointer}.th td.tc.b{color:var(--exp);background:rgba(192,71,15,.16);cursor:pointer}</style>';
} };

/* ════════════ AI / ML ════════════ */
V['privacy/ai'] = { title: 'AI / ML', render: function () {
  var arch = ['ON DEVICE', 'ISOLATED PRIVATE CLOUD', 'INTERNAL CLOUD', 'THIRD-PARTY MODEL'];
  var AC = { 'ON DEVICE': '#0b7d60', 'ISOLATED PRIVATE CLOUD': '#1f6ac0', 'INTERNAL CLOUD': '#946300', 'THIRD-PARTY MODEL': '#c0470f' };
  var ai8 = [['Purpose', 'Collected to run a feature; now useful to train a model.'], ['Deletion', 'You can delete a row; not easily what a model learned from it.'], ['Consent', 'Permission to post was never permission to train.'], ['Inference', 'Models guess what you never shared.'], ['Context', 'A helpful assistant needs mail, messages and calendar in one place.'], ['Boundaries', 'Permissions were per app; an agent acts across all of them.'], ['Input = command', 'A page or email can carry instructions that make an agent leak.'], ['Retention', 'Prompts are records.']];
  return P.pageHead('Privacy', 'AI / ML privacy center', 'Every AI and ML system, where it thinks, what leaves, what is kept, and whether it can forget. On device when it can, verifiable private cloud when it must, an outside model only when the person says yes.') +
    '<div class="archbar">' + arch.map(function (a) { var ms = NS.models.filter(function (m) { return m.hosting === a; }); return '<div class="ab" style="border-top:3px solid ' + AC[a] + '"><div class="mono small" style="color:' + AC[a] + '">' + a + '</div><div class="small dim" style="margin:2px 0 8px">' + { 'ON DEVICE': 'Nothing leaves the phone', 'ISOLATED PRIVATE CLOUD': 'Sealed servers you can check', 'INTERNAL CLOUD': 'The company can see it, by policy', 'THIRD-PARTY MODEL': 'The provider can see it, by contract' }[a] + '</div>' + (ms.length ? ms.map(function (m) { return chip(m.id); }).join('') : '<span class="dim small">—</span>') + '</div>'; }).join('') + '</div>' +
    '<div class="grid g2" style="margin:14px 0">' + NS.models.map(function (m) {
      var f = P.findingsFor(m.id), risky = m.hosting === 'THIRD-PARTY MODEL' || m.provenance !== 'documented';
      return '<div class="card"><div class="card-h"><div><button class="chip" data-ent="' + m.id + '" style="font-size:14px;font-weight:650;color:var(--text)">' + esc(m.name) + '</button><div class="small dim" style="margin-top:4px">' + esc(m.provider) + ' · ' + esc(P.name(m.team)) + '</div></div><span class="tag" style="color:' + AC[m.hosting] + ';border-color:' + AC[m.hosting] + '">' + esc(m.hosting) + '</span></div>' +
        P.kv([['Training data', m.training.length ? P.chips(m.training) : '—'], ['Provenance', m.provenance === 'documented' ? '<span class="ok">documented</span>' : m.provenance === 'unknown' ? unk() : '<span class="warn">partial</span>'], ['Prompt logging', /full/.test(m.promptLogging) ? '<span class="bad">' + esc(m.promptLogging) + '</span>' : esc(m.promptLogging)], ['Trains on user input', m.trainsOnUserInput == null ? unk() : m.trainsOnUserInput ? (m.hosting === 'ON DEVICE' ? 'yes — federated, DP' : '<span class="bad">yes</span>') : 'no'], ['Deletion path', /unknown/.test(m.deletionPath) ? unk() : esc(m.deletionPath)], ['Memorisation testing', /not tested/.test(m.memorization) ? '<span class="bad">not tested</span>' : esc(m.memorization)], ['Review', esc(m.review)]]) +
        (f.length ? '<div style="margin-top:8px">' + f.map(function (x) { return chip(x.id, x.id); }).join(' ') + '</div>' : '') + '</div>';
    }).join('') + '</div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:10px">AI breaks eight assumptions privacy was built on</h2><div class="grid g4">' + ai8.map(function (x, i) { return '<div><div class="mono small dim">' + (i + 1) + ' · ' + esc(x[0].toUpperCase()) + '</div><div class="small">' + esc(x[1]) + '</div></div>'; }).join('') + '</div></div>' +
    '<style>.archbar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ab{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:flex-start;gap:4px}@media(max-width:860px){.archbar{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>';
} };

/* ════════════ PETs + DP ════════════ */
var THREATS = [['breach', 'An outsider steals the store'], ['insider', 'An insider or curious employee'], ['linkability', 'Contexts get stitched together'], ['re-identification', 'Someone singles out a person in a release'], ['partner', 'A partner over-collects or reuses'], ['surveillance', 'Behaviour observed that people expected to stay private'], ['membership inference', 'Someone learns whether a person is in the data'], ['secondary use', 'Future us / scope creep']];
P.state.dpExtra = P.state.dpExtra || [];
V['privacy/pets'] = { title: 'PETs & DP', render: function (s, q) {
  var th = q.t || 'linkability';
  var grid = ['REDUCE DATA', 'TRANSFORM DATA', 'PROTECT COMPUTATION'].map(function (g) {
    return '<div><div class="mono small dim" style="margin:6px 0 8px">' + g + '</div><div class="pet-grid" style="grid-template-columns:repeat(' + (g === 'PROTECT COMPUTATION' ? 3 : 2) + ',minmax(0,1fr))">' + NS.pets.filter(function (p) { return p.group === g; }).map(function (p) {
      var m = p.threat.some(function (t) { return t === th || (th === 'breach' && t === 'exposure'); });
      return '<div class="pet ' + (m ? 'match' : 'nomatch') + '"><div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap"><b>' + esc(p.name) + '</b>' + (m ? '<span class="tag sev-GOOD">addresses it</span>' : '') + '</div><div class="small muted" style="margin:4px 0 8px">' + esc(p.benefit) + '</div><dl class="kv" style="grid-template-columns:96px 1fr;font-size:12px"><dt>Utility</dt><dd>' + esc(p.utility) + '</dd><dt>Cost</dt><dd>' + esc(p.perf) + '</dd><dt>Trust in</dt><dd>' + esc(p.trust) + '</dd><dt>Complexity</dt><dd>' + esc(p.complexity) + '</dd><dt>Residual</dt><dd>' + esc(p.residual) + '</dd></dl>' + (p.fit.length ? '<div class="small dim" style="margin-top:6px">Fits: ' + p.fit.map(function (f) { return chip(f); }).join(' ') + '</div>' : '') + '</div>';
    }).join('') + '</div></div>';
  }).join('');
  return P.pageHead('Privacy', 'Privacy-enhancing technology advisor', 'Never recommend a PET because it sounds advanced. <b>What threat are we addressing?</b> Pick one; techniques that do not address it fade out.') +
    '<div class="toolbar"><span class="small muted">Threat:</span><div class="seg" role="group" aria-label="Threat" style="flex-wrap:wrap">' + THREATS.map(function (t) { return '<button data-go="privacy/pets?t=' + encodeURIComponent(t[0]) + '" aria-pressed="' + (t[0] === th) + '" title="' + esc(t[1]) + '">' + esc(t[0]) + '</button>'; }).join('') + '</div></div>' +
    '<div class="grid" style="gap:6px;margin-bottom:18px">' + grid + '</div>' + dpLedger();
}, mount: function (root) {
  var f = root.querySelector('#dpForm'); if (!f) return;
  f.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var eps = parseFloat(root.querySelector('#dpEps').value), desc = root.querySelector('#dpDesc').value || 'New query';
    var spent = NS.dp.releases.concat(P.state.dpExtra).reduce(function (s, r) { return s + (r.denied ? 0 : r.eps); }, 0), left = NS.dp.total - spent;
    P.state.dpExtra.push({ q: 'Q' + (NS.dp.releases.length + P.state.dpExtra.length + 1), desc: desc, eps: eps, date: NS.TODAY, denied: !(eps > 0 && eps <= left + 1e-9) });
    P._keepScroll = true; P.render();
  });
} };
function dpLedger() {
  var D = NS.dp, all = D.releases.concat(P.state.dpExtra), spent = 0;
  var bar = all.map(function (r) { if (r.denied) return ''; spent += r.eps; return '<span class="dps" style="width:' + (r.eps / D.total * 100) + '%" title="' + esc(r.q + ' ε ' + r.eps) + '">' + esc(r.q) + ' · ε ' + r.eps + '</span>'; }).join('');
  var left = Math.max(0, D.total - spent);
  return '<div class="card"><div class="card-h"><h2 class="sec">Differential privacy — budget ledger</h2><span class="sub">' + esc(D.dataset) + '</span></div>' +
    '<div class="dpbar">' + bar + '<span class="dpl" style="width:' + (left / D.total * 100) + '%">left ' + (Math.round(left * 100) / 100) + '</span></div><div class="mono small dim" style="margin:6px 0 14px">TOTAL ε = ' + D.total + ' · δ = ' + esc(D.delta) + '</div>' +
    '<div class="grid g2"><div>' + P.kv([['Mechanism', esc(D.mechanism)], ['Sensitivity (Δ)', esc(D.sensitivity)], ['Contribution limit', esc(D.contribution)], ['ε per what?', '<b>' + esc(D.unit) + '</b>'], ['Population', fmtN(D.population)]]) + '</div>' +
    '<div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Release</th><th>Query</th><th class="num">ε</th><th>Result</th></tr></thead><tbody>' + all.map(function (r) { return '<tr><td class="mono small">' + esc(r.q) + '<div class="dim">' + esc(r.date) + '</div></td><td class="small">' + esc(r.desc) + '</td><td class="num">' + r.eps + '</td><td>' + (r.denied ? '<span class="tag sev-HIGH">DENIED</span>' : '<span class="tag sev-GOOD">released</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<form id="dpForm" class="toolbar" style="margin-top:10px"><input id="dpDesc" type="text" placeholder="New query, e.g. basket size by age band" aria-label="Query description" style="flex:1;min-width:160px"><label class="small muted" for="dpEps">ε</label><input id="dpEps" type="number" step="0.1" min="0.1" value="1" style="width:74px"><button class="btn primary" type="submit">Request release</button></form>' +
    '<p class="small dim">A ledger that refuses the query is a feature, not an outage. Asking the same question again spends budget again — cache released answers.</p></div></div></div>' +
    '<style>.dpbar{display:flex;height:34px;border-radius:9px;overflow:hidden;border:1px solid var(--line2)}.dps{display:flex;align-items:center;justify-content:center;font:600 11px var(--mono);color:#ffffff;background:var(--ctl);border-right:2px solid var(--bg);white-space:nowrap;overflow:hidden}.dps:nth-child(even){background:#0a6a51}.dpl{display:flex;align-items:center;justify-content:center;font:600 11px var(--mono);color:var(--muted);background:repeating-linear-gradient(45deg,var(--panel2) 0 6px,var(--panel) 6px 12px)}</style>';
}

/* ════════════ THREAT MODELS (LINDDUN) ════════════ */
var LIND = ['Linking', 'Identifying', 'Non-repudiation', 'Detecting', 'Data disclosure', 'Unawareness', 'Non-compliance'];
var ADV = { Linking: 'TRACKER', Identifying: 'OUTSIDER', 'Non-repudiation': 'INSIDER', Detecting: 'TRACKER', 'Data disclosure': 'OUTSIDER', Unawareness: 'FUTURE ORGANISATION', 'Non-compliance': 'PARTNER' };
V['privacy/threats'] = { title: 'Threat Models', render: function (s, q) {
  var targets = NS.products.map(function (p) { return p.id; });
  var cell = {}, max = 1;
  P.openFindings().forEach(function (f) { var bu = P.buOf(f.id); var p = f.entities.filter(function (e) { return P.get(e) && P.get(e).type === 'product'; })[0]; if (!p) { var sys = f.entities.filter(function (e) { return P.get(e) && (P.get(e).type === 'system' || P.get(e).type === 'dataset'); })[0]; if (sys) p = P.get(sys).obj.product; } if (!p) return; f.linddun.forEach(function (l) { var k = p + '|' + l; (cell[k] = cell[k] || []).push(f.id); max = Math.max(max, cell[k].length); }); });
  var sel = q.c ? q.c.split('|') : null;
  var h = '<div class="heat" style="grid-template-columns:minmax(76px,170px) repeat(7,minmax(28px,1fr))"><span></span>' + LIND.map(function (l) { return '<span class="hh">' + l.toUpperCase() + '</span>'; }).join('');
  targets.forEach(function (p) { h += '<span class="hr">' + esc(P.name(p)) + '</span>'; LIND.forEach(function (l) { var v = (cell[p + '|' + l] || []).length, a = v / max; h += '<button class="hc" data-go="privacy/threats?c=' + encodeURIComponent(p + '|' + l) + '" style="background:' + (v ? 'rgba(196,45,73,' + (0.14 + a * 0.7).toFixed(2) + ')' : 'var(--panel)') + ';color:' + (a > 0.6 ? '#ffffff' : 'var(--muted)') + (sel && sel[0] === p && sel[1] === l ? ';outline:2px solid var(--info)' : '') + '" aria-label="' + esc(P.name(p) + ' ' + l + ': ' + v) + '">' + (v || '') + '</button>'; }); });
  h += '</div>';
  var list = sel ? (cell[sel[0] + '|' + sel[1]] || []) : P.openFindings().filter(function (f) { return f.sev === 'HIGH'; }).map(function (f) { return f.id; }).slice(0, 5);
  var chains = list.map(function (id) {
    var f = P.get(id).obj, data = f.entities.filter(function (e) { return P.get(e) && P.get(e).type === 'dataset'; })[0], sys = f.entities.filter(function (e) { return P.get(e) && P.get(e).type === 'system'; })[0], ctl = f.entities.filter(function (e) { return P.get(e) && P.get(e).type === 'control'; })[0];
    var th = sel ? sel[1] : f.linddun[0];
    return '<div class="card flat" style="margin-bottom:10px"><div class="card-h"><b>' + esc(f.title) + '</b><span>' + P.sev(f.sev) + ' <span class="tag">' + esc(ADV[th] || 'OUTSIDER') + '</span></span></div><div class="chain">' +
      [['Threat', th + ' — ' + f.kind, 'bad'], ['Data', data ? P.name(data) : '—', ''], ['System', sys ? P.name(sys) : '—', ''], ['Human harm', f.harms.join(', '), 'bad'], ['Control', ctl ? P.name(ctl) + ' (L' + P.get(ctl).obj.level + ')' : 'none', ctl ? '' : 'unk'], ['Owner', f.owner ? P.name(f.owner) : 'UNKNOWN', f.owner ? '' : 'unk'], ['Evidence', f.detector, ''], ['Status', f.status, f.status === 'open' ? 'bad' : 'good']].map(function (x) { return '<div class="cn ' + x[2] + '"><div class="cl">' + x[0] + '</div><div class="cv">' + esc(x[1]) + '</div></div>'; }).join('') + '</div>' + chip(id, 'Open ' + id) + '</div>';
  }).join('');
  return P.pageHead('Privacy', 'Privacy threat modelling — LINDDUN', 'Walk every category across every element of the data-flow diagram. Likely adversaries: outsider, partner, insider, tracker, and the future organisation (scope creep). Every threat connects to data, system, human harm, control, owner, evidence and status.') +
    '<div class="grid g-main"><div class="card"><div class="card-h"><h2 class="sec">Product × LINDDUN</h2><span class="sub">open findings per category</span></div>' + h + '</div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:8px">The seven categories</h2><ul class="checks small">' + [['L', 'Linking', 'Can items or actions be tied to the same person?'], ['I', 'Identifying', 'Can someone learn who the person is?'], ['N', 'Non-repudiation', 'Is a person unable to deny an action they would want to?'], ['D', 'Detecting', 'Can someone tell that data about a person exists?'], ['D', 'Data disclosure', 'Is personal data exposed more than necessary?'], ['U', 'Unawareness', 'Are people uninformed, or unable to act?'], ['N', 'Non-compliance', 'Does it violate law, policy or promise?']].map(function (x) { return '<li><span class="ic mono">' + x[0] + '</span><span><b>' + x[1] + '</b> — <span class="muted">' + x[2] + '</span></span></li>'; }).join('') + '</ul></div></div>' +
    '<h2 class="sec" style="margin:18px 0 10px">' + (sel ? esc(P.name(sel[0]) + ' · ' + sel[1]) : 'Highest-severity threat chains') + '</h2>' + (chains || '<p class="dim">No open findings in this cell.</p>');
} };
})();
