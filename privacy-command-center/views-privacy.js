/* Views: Privacy (Reviewer + Builder work). */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk, fmtDays = P.fmtDays, uniq = P.uniq;
var V = P.views;

/* ── small shared helpers ─────────────────────────────────── */
function pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function typeOf(id) { var e = P.get(id); return e ? e.type : null; }
function isVendor(id) { var t = typeOf(id); return t === 'vendor' || t === 'subprocessor'; }
function isOpen(f) { return f.status !== 'accepted' && f.status !== 'closed' && f.status !== 'mitigated'; }
/* stat tiles that carry their rule */
function statRow(stats, cls) { return '<div class="stat-row pv-stats' + (cls ? ' ' + cls : '') + '">' + stats.map(function (x) { return '<div class="stat"><div class="sv' + (x[3] ? ' ' + x[3] : '') + '">' + x[1] + '</div><div class="sl">' + esc(x[0]) + '</div><div class="sr">' + esc(x[2]) + '</div></div>'; }).join('') + '</div>'; }

/* Risk radar and Worst Day live in views-investigate.js. */
function ext(a, o) { var r = {}; Object.keys(a).forEach(function (k) { r[k] = a[k]; }); Object.keys(o).forEach(function (k) { r[k] = o[k]; }); return r; }

/* ════════════ REVIEWS + WORKBENCH ════════════ */
/* What a feature touches: its systems (and their children), datasets, flows,
 * and the models linked to it. Models link directly (feature store, vector
 * store, training data or a flow); a feature with no direct link falls back to
 * its product team's models that no other feature claims. */
function scopeBase(fid) {
  var sys = NS.systems.filter(function (s) { return s.feature === fid; });
  var sysIds = sys.map(function (s) { return s.id; }).concat(NS.systems.filter(function (s) { return sys.some(function (p) { return s.parent === p.id; }); }).map(function (s) { return s.id; }));
  var ds = NS.datasets.filter(function (d) { return sysIds.indexOf(d.system) >= 0; });
  var flows = NS.flows.filter(function (x) { return sysIds.indexOf(x.from) >= 0 || sysIds.indexOf(x.to) >= 0; });
  return { sysIds: sysIds, ds: ds, flows: flows };
}
function modelLinked(m, b) {
  var dsIds = b.ds.map(function (d) { return d.id; });
  return b.sysIds.indexOf(m.featureStore) >= 0 || b.sysIds.indexOf(m.vector) >= 0 || m.training.some(function (t) { return dsIds.indexOf(t) >= 0; }) || b.flows.some(function (f) { return f.from === m.id || f.to === m.id; });
}
var SCOPE = {};
function featureScope(fid) {
  if (SCOPE[fid]) return SCOPE[fid];
  var b = scopeBase(fid), f = P.get(fid).obj;
  var models = NS.models.filter(function (m) { return modelLinked(m, b); }), viaTeam = false;
  if (!models.length) {
    var team = P.get(f.product) ? P.get(f.product).obj.team : null;
    models = NS.models.filter(function (m) { return m.team === team && !NS.features.some(function (o) { return o.id !== fid && modelLinked(m, scopeBase(o.id)); }); });
    viaTeam = models.length > 0;
  }
  var ds = b.ds.slice();
  if (viaTeam) models.forEach(function (m) { m.training.forEach(function (t) { var e = P.get(t); if (e && ds.indexOf(e.obj) < 0) ds.push(e.obj); }); });
  var dsIds = ds.map(function (d) { return d.id; });
  /* training links drawn on the diagram (not flows): training dataset's system → model */
  var train = []; models.forEach(function (m) { m.training.forEach(function (t) { var e = P.get(t); if (!e || dsIds.indexOf(t) < 0) return; var already = b.flows.some(function (fl) { return fl.from === e.obj.system && fl.to === m.id; }); if (!already) train.push({ id: m.id, from: e.obj.system, to: m.id, tier: P.dsTier(e.obj), status: 'reviewed', boundary: 'internal', flags: [], training: true, label: m.name + ' trains on ' + e.obj.name }); }); });
  var finds = NS.findings.filter(function (x) { return x.entities.indexOf(fid) >= 0 || x.entities.some(function (e) { return b.sysIds.indexOf(e) >= 0 || dsIds.indexOf(e) >= 0 || b.flows.some(function (fl) { return fl.id === e; }); }); });
  var blockers = finds.filter(function (x) { return isOpen(x) && (x.sev === 'HIGH' || x.status === 'blocking launch'); });
  return (SCOPE[fid] = { sysIds: b.sysIds, ds: ds, flows: b.flows, models: models, viaTeam: viaTeam, train: train, finds: finds, blockers: blockers });
}
/* one blocker rule, everywhere: open findings in the feature's scope that are HIGH or marked "blocking launch" */
P.reviewBlockers = function (fid) { return featureScope(fid).blockers; };
/* The typed review.blockers field is replaced by the computed rule, so the Kanban, tiles,
   personas and overview can never disagree. */
NS.reviews.forEach(function (r) { Object.defineProperty(r, 'blockers', { configurable: true, enumerable: true, get: function () { return P.reviewBlockers(r.feature).length; } }); });
function miniDFD(sysIds, flows) {
  var nodes = uniq(flows.map(function (f) { return f.from; }).concat(flows.map(function (f) { return f.to; })).concat(sysIds));
  if (!nodes.length) return unk('No lineage recorded');
  var lev = {}; nodes.forEach(function (n) { lev[n] = 0; });
  for (var k = 0; k < 6; k++) flows.forEach(function (f) { if (lev[f.to] <= lev[f.from]) lev[f.to] = lev[f.from] + 1; });
  var colsN = {}; nodes.forEach(function (n) { (colsN[lev[n]] = colsN[lev[n]] || []).push(n); });
  var maxC = Math.max.apply(null, Object.keys(colsN).map(Number)), maxR = Math.max.apply(null, Object.keys(colsN).map(function (c) { return colsN[c].length; }));
  var W = Math.max(560, (maxC + 1) * 180 + 20), H = maxR * 56 + 30, pos = {};
  Object.keys(colsN).forEach(function (c) { colsN[c].forEach(function (n, i) { pos[n] = [20 + c * 180, 20 + i * 56 + (maxR - colsN[c].length) * 28]; }); });
  var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Feature data-flow diagram">';
  flows.forEach(function (f) { var a = pos[f.from], b = pos[f.to]; if (!a || !b) return; var ax = a[0] + 150, ay = a[1] + 15, bx = b[0], by = b[1] + 15, mx = (ax + bx) / 2; if (b[0] <= a[0]) { bx = b[0] + 150; mx = ax + 40; } var c = f.training ? '#963bbd' : f.status === 'unknown' ? '#6346c9' : (f.flags || []).indexOf('purpose_change') >= 0 ? '#946300' : f.boundary === 'third_party' ? '#c0470f' : '#9aa1ac'; s += '<g class="edge" data-ent="' + f.id + '" tabindex="0" role="button" aria-label="' + esc(f.label || P.name(f.id)) + '"><path class="hit" d="M' + ax + ',' + ay + ' C' + mx + ',' + ay + ' ' + mx + ',' + by + ' ' + bx + ',' + by + '"/><path class="vis" d="M' + ax + ',' + ay + ' C' + mx + ',' + ay + ' ' + mx + ',' + by + ' ' + bx + ',' + by + '" fill="none" stroke="' + c + '" stroke-width="' + (1 + f.tier * 0.5) + '"' + (f.training ? ' stroke-dasharray="1 4" stroke-linecap="round"' : f.status !== 'reviewed' ? ' stroke-dasharray="5 4"' : '') + '/></g>'; });
  nodes.forEach(function (n) { var p = pos[n], e = P.get(n); if (!e) return; var tp = e.type, col = tp === 'vendor' || tp === 'subprocessor' ? '#c0470f' : tp === 'model' ? '#963bbd' : '#4f78a8'; var l = P.name(n); if (l.length > 21) l = l.slice(0, 20) + '…'; s += '<g class="node" data-ent="' + n + '" tabindex="0" role="button" aria-label="' + esc(P.name(n)) + '"><rect x="' + p[0] + '" y="' + p[1] + '" width="150" height="30" rx="8" fill="#fffdf9" stroke="#d3cbbb"/><rect x="' + p[0] + '" y="' + p[1] + '" width="3.5" height="30" rx="2" fill="' + col + '"/><text x="' + (p[0] + 10) + '" y="' + (p[1] + 19) + '" fill="#1d2430" font-size="11">' + esc(l) + '</text></g>'; });
  return s + '</svg>';
}
P.miniDFD = miniDFD;

/* Consent lives in views-operate.js; purpose in views-investigate.js. */

/* ════════════ TRACKING OBSERVATORY ════════════ */
function isThird(t) { return /third/.test(t.party); }
function preciseLocation(t) { return /\b(lat|lon|location)\b/i.test(t.fields); }
V['privacy/tracking'] = { title: 'Tracking', render: function () {
  var T = NS.trackers, pages = NS.trackPages;
  var short = function (t) { return t.name.replace(/\s*\(.*\)$/, ''); };
  var heat = '<div class="tbl-wrap"><table class="tbl th"><thead><tr><th>Page / app</th><th>Context</th>' + T.map(function (t) { return '<th class="rot" title="' + esc(t.name) + '"><span>' + esc(short(t)) + '</span></th>'; }).join('') + '</tr></thead><tbody>' + pages.map(function (p) {
    var sens = /authenticated|health|children|financial/.test(p.ctx);
    return '<tr><td>' + esc(p.page) + '</td><td class="small ' + (sens ? 'warn' : 'dim') + '">' + esc(p.ctx) + '</td>' + T.map(function (t) {
      var on = p.trackers.indexOf(t.id) >= 0, bad = on && ((sens && isThird(t)) || (isThird(t) && t.review !== 'reviewed') || preciseLocation(t)), badish = on && sens && t.flags.length;
      return '<td class="tc' + (bad ? ' b' : badish ? ' m' : on ? ' o' : '') + '"' + (on ? ' data-ent="' + t.id + '" role="button" tabindex="0" aria-label="' + esc(t.name + ' on ' + p.page) + '"' : '') + '>' + (on ? '●' : '') + '</td>';
    }).join('') + '</tr>';
  }).join('') + '</tbody></table></div>';
  var flagsAll = {}; T.forEach(function (t) { t.flags.forEach(function (f) { if (f === 'unreviewed') return; (flagsAll[f] = flagsAll[f] || []).push(t.id); }); });
  var unrev = T.filter(function (t) { return t.review !== 'reviewed'; }).map(function (t) { return t.id; });
  NS.trackPages.forEach(function (p) { if (/children/.test(p.ctx) && p.trackers.length) (flagsAll['tracking in children\'s context'] = flagsAll['tracking in children\'s context'] || []).push(p.trackers[0]); });
  var groups = [['UNREVIEWED', unrev, 'review ≠ reviewed']].concat(Object.keys(flagsAll).map(function (f) { return [f.toUpperCase(), flagsAll[f]]; }));
  return P.pageHead('Privacy', 'Web & mobile tracking observatory', 'Cookies, storage, advertising IDs, pixels, SDKs, fingerprinting, link decoration, CNAME cloaking, email pixels, server-side forwarding. The pixel or SDK usually behaves exactly as designed; what fails is a review that never asked where the events went.') +
    '<div class="grid g-main" style="margin-bottom:14px"><div class="card"><div class="card-h"><h2 class="sec">Where each tracker fires</h2><span class="sub"><span class="bad">●</span> third party on a sensitive page, an unreviewed third party, or precise location · <span class="warn">●</span> flagged tracker on a sensitive page</span></div>' + heat + '</div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:10px">Flags</h2>' + groups.map(function (g) { return '<div style="margin-bottom:8px"><div class="small bad mono">' + esc(g[0]) + ' <span class="dim">' + g[1].length + '</span></div>' + (g[1].length ? P.chips(g[1]) : '<span class="small ok">none</span>') + '</div>'; }).join('') + '</div></div>' +
    '<div class="tbl-wrap"><table class="tbl trk"><thead><tr><th>Tracker</th><th>Kind</th><th>Domain</th><th>Party</th><th>Purpose</th><th>Identifier</th><th>Lifespan</th><th>Fields</th><th>Consent</th><th>Review</th></tr></thead><tbody>' + T.map(function (t) { return '<tr class="click" data-ent="' + t.id + '" tabindex="0"><td><b>' + esc(t.name) + '</b><div class="small dim">' + esc(t.company) + '</div></td><td class="small">' + esc(t.kind) + '</td><td class="mono small">' + esc(t.domain) + '</td><td class="small">' + esc(t.party) + '</td><td class="small">' + (t.purpose === 'unknown' ? unk() : esc(t.purpose)) + '</td><td>' + (t.identifier ? chip(t.identifier) : '—') + '</td><td class="small">' + (/unknown/.test(t.lifespan) ? unk() : esc(t.lifespan)) + '</td><td class="small">' + esc(t.fields) + '</td><td class="small">' + (/^unknown$/.test(t.consent) ? unk() : esc(t.consent)) + '</td><td>' + (t.review === 'reviewed' ? '<span class="small ok">reviewed</span>' : '<span class="tag sev-HIGH">unreviewed</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<style>.th th.rot{height:165px;vertical-align:bottom;padding:4px;text-transform:none;letter-spacing:0}.th th.rot span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10.5px;white-space:nowrap}.th td.tc{text-align:center;min-width:24px;color:var(--dim)}.th td.tc.o{color:var(--info);cursor:pointer}.th td.tc.m{color:var(--med);background:rgba(148,99,0,.1);cursor:pointer}.th td.tc.b{color:var(--exp);background:rgba(192,71,15,.16);cursor:pointer}</style>';
} };

/* AI & agents lives in views-investigate.js. */

/* ════════════ PETs + DP ════════════ */
var THREATS = [['breach', 'An outsider steals the store'], ['insider', 'An insider or curious employee'], ['linkability', 'Contexts get stitched together'], ['re-identification', 'Someone singles out a person in a release'], ['partner', 'A partner over-collects or reuses'], ['surveillance', 'Behaviour observed that people expected to stay private'], ['membership inference', 'Someone learns whether a person is in the data'], ['secondary use', 'Future us / scope creep']];
/* technique threat tags that are not one of the eight, mapped onto the eight */
var THREAT_MAP = { exposure: ['breach'], 'exposure in testing': ['breach', 'insider'], processor: ['insider'], cloud: ['breach'], 'aggregator curiosity': ['insider'], 'data sharing': ['partner'] };
var THREAT_IDS = THREATS.map(function (t) { return t[0]; });
function petThreats(p) { return uniq([].concat.apply([], p.threat.map(function (t) { return THREAT_IDS.indexOf(t) >= 0 ? [t] : (THREAT_MAP[t] || []); }))); }
P.state.dpExtra = P.state.dpExtra || [];
V['privacy/pets'] = { title: 'PETs & DP', render: function (s, q) {
  var th = THREAT_IDS.indexOf(q.t) >= 0 ? q.t : 'linkability';
  var grid = ['REDUCE DATA', 'TRANSFORM DATA', 'PROTECT COMPUTATION'].map(function (g) {
    return '<div><div class="mono small dim" style="margin:6px 0 8px">' + g + '</div><div class="pet-grid ' + (g === 'PROTECT COMPUTATION' ? 'pg3' : 'pg2') + '">' + NS.pets.filter(function (p) { return p.group === g; }).map(function (p) {
      var ts = petThreats(p), m = ts.indexOf(th) >= 0, mapped = p.threat.filter(function (t) { return THREAT_IDS.indexOf(t) < 0; });
      return '<div class="pet ' + (m ? 'match' : 'nomatch') + '"><div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap"><b>' + esc(p.name) + '</b>' + (m ? '<span class="tag sev-GOOD">addresses it</span>' : '') + '</div><div class="small muted" style="margin:4px 0 8px">' + esc(p.benefit) + '</div><dl class="kv" style="grid-template-columns:96px 1fr;font-size:12px"><dt>Addresses</dt><dd>' + esc(ts.join(' · ')) + (mapped.length ? ' <span class="dim">(from: ' + esc(mapped.join(', ')) + ')</span>' : '') + '</dd><dt>Utility</dt><dd>' + esc(p.utility) + '</dd><dt>Cost</dt><dd>' + esc(p.perf) + '</dd><dt>Trust in</dt><dd>' + esc(p.trust) + '</dd><dt>Complexity</dt><dd>' + esc(p.complexity) + '</dd><dt>Residual</dt><dd>' + esc(p.residual) + '</dd></dl>' + (p.fit.length ? '<div class="small dim pet-fit" style="margin-top:6px">Fits: ' + p.fit.map(function (f) { return chip(f); }).join(' ') + '</div>' : '') + '</div>';
    }).join('') + '</div></div>';
  }).join('');
  return P.pageHead('Privacy', 'Privacy-enhancing technology advisor', 'Never recommend a PET because it sounds advanced. <b>What threat are we addressing?</b> Pick one; techniques that do not address it fold away to their name and benefit.') +
    '<div class="toolbar"><span class="small muted">Threat:</span><div class="seg" role="group" aria-label="Threat" style="flex-wrap:wrap">' + THREATS.map(function (t) { return '<button data-go="privacy/pets?t=' + encodeURIComponent(t[0]) + '" aria-pressed="' + (t[0] === th) + '" title="' + esc(t[1]) + '">' + esc(t[0]) + '</button>'; }).join('') + '</div></div>' +
    '<div class="grid" style="gap:6px;margin-bottom:18px">' + grid + '</div>' + dpLedger();
}, mount: function (root) {
  var f = root.querySelector('#dpForm'); if (!f) return;
  f.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var raw = root.querySelector('#dpEps').value, eps = parseFloat(raw), desc = root.querySelector('#dpDesc').value.trim() || 'New query', err = root.querySelector('#dpErr');
    if (!isFinite(eps) || eps <= 0) { err.textContent = 'Enter an ε greater than 0 — nothing was spent.'; root.querySelector('#dpEps').focus(); return; }
    var spent = NS.dp.releases.concat(P.state.dpExtra).reduce(function (s, r) { return s + (r.denied ? 0 : r.eps); }, 0), left = NS.dp.total - spent;
    P.state.dpExtra.push({ q: 'Q' + (NS.dp.releases.length + P.state.dpExtra.length + 1), desc: desc, eps: eps, date: NS.TODAY, denied: !(eps <= left + 1e-9) });
    P._keepScroll = true; P.render();
  });
  var r = root.querySelector('#dpReset'); if (r) r.addEventListener('click', function () { P.state.dpExtra = []; P._keepScroll = true; P.render(); });
} };
function dpLedger() {
  var D = NS.dp, all = D.releases.concat(P.state.dpExtra), spent = 0;
  var bar = all.map(function (r) { if (r.denied) return ''; spent += r.eps; return '<span class="dps" style="width:' + (r.eps / D.total * 100) + '%" title="' + esc(r.q + ' ε ' + r.eps) + '">' + esc(r.q) + ' · ε ' + r.eps + '</span>'; }).join('');
  var left = Math.max(0, D.total - spent);
  return '<div class="card"><div class="card-h"><h2 class="sec">Differential privacy — budget ledger</h2><span class="sub">' + esc(D.dataset) + '</span></div>' +
    '<div class="dpbar">' + bar + '<span class="dpl" style="width:' + (left / D.total * 100) + '%">left ' + (Math.round(left * 100) / 100) + '</span></div><div class="mono small dim" style="margin:6px 0 14px">TOTAL ε = ' + D.total + ' · δ = ' + esc(D.delta) + ' · spent = Σ ε of released queries</div>' +
    '<div class="grid g2"><div>' + P.kv([['Mechanism', esc(D.mechanism.replace(/\s*\(.*\)\s*$/, '')) + ' noise'], ['Accounting', 'basic composition — each release’s ε is added to the total (the simplest bound, and exactly what this ledger does)'], ['Sensitivity (Δ)', esc(D.sensitivity)], ['Contribution limit', esc(D.contribution)], ['ε per what?', '<b>' + esc(D.unit) + '</b>'], ['Population', fmtN(D.population)]]) + '</div>' +
    '<div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Release</th><th>Query</th><th class="num">ε</th><th>Result</th></tr></thead><tbody>' + all.map(function (r) { return '<tr><td class="mono small">' + esc(r.q) + '<div class="dim">' + esc(r.date) + '</div></td><td class="small">' + esc(r.desc) + '</td><td class="num">' + r.eps + '</td><td>' + (r.denied ? '<span class="tag sev-HIGH">DENIED</span>' : '<span class="tag sev-GOOD">released</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<form id="dpForm" class="toolbar" style="margin-top:10px" novalidate><input id="dpDesc" type="text" placeholder="New query, e.g. basket size by age band" aria-label="Query description" style="flex:1;min-width:160px"><label class="small muted" for="dpEps">ε</label><input id="dpEps" type="number" step="0.1" min="0.1" value="1" style="width:74px" aria-describedby="dpErr"><button class="btn primary" type="submit">Request release</button>' + (P.state.dpExtra.length ? '<button class="btn" type="button" id="dpReset">Reset ledger</button>' : '') + '</form><p id="dpErr" class="small bad" role="alert" style="margin:4px 0 0"></p>' +
    '<p class="small dim">A ledger that refuses the query is a feature, not an outage. Asking the same question again spends budget again — cache released answers.' + (P.state.dpExtra.length ? ' Your ' + pl(P.state.dpExtra.length, 'request') + ' stay until you reset the ledger or reload the page.' : '') + '</p></div></div></div>' +
    '<style>.dpbar{display:flex;height:34px;border-radius:9px;overflow:hidden;border:1px solid var(--line2)}.dps{display:flex;align-items:center;justify-content:center;font:600 11px var(--mono);color:#ffffff;background:var(--ctl);border-right:2px solid var(--bg);white-space:nowrap;overflow:hidden}.dps:nth-child(even){background:#0a6a51}.dpl{display:flex;align-items:center;justify-content:center;font:600 11px var(--mono);color:var(--muted);background:repeating-linear-gradient(45deg,var(--panel2) 0 6px,var(--panel) 6px 12px)}</style>';
}

/* ════════════ THREAT MODELS (LINDDUN) ════════════ */
var LIND = ['Linking', 'Identifying', 'Non-repudiation', 'Detecting', 'Data disclosure', 'Unawareness', 'Non-compliance'];
var LCODE = { Linking: 'Li', Identifying: 'Id', 'Non-repudiation': 'Nr', Detecting: 'De', 'Data disclosure': 'Dd', Unawareness: 'Un', 'Non-compliance': 'Nc' };
var LNORM = { Unintervenability: 'Unawareness' }; /* LINDDUN groups unawareness & unintervenability */
var SHARED = '_shared';
function rowName(p) { return p === SHARED ? 'Shared platform / vendors' : P.name(p); }
/* adversary, from what the finding touches: an outside party → PARTNER; a trust boundary inside Northstar → FUTURE ORGANISATION */
function adversaryOf(f) {
  var es = f.entities.map(P.get).filter(Boolean);
  if (es.some(function (e) { return e.type === 'vendor' || e.type === 'subprocessor' || e.type === 'tracker' || (e.type === 'flow' && e.obj.boundary === 'third_party'); })) return ['PARTNER', 'a vendor, subprocessor or third-party flow is involved'];
  if (es.some(function (e) { return e.type === 'flow' && e.obj.boundary === 'trust'; })) return ['FUTURE ORGANISATION', 'a flow crosses a trust boundary inside Northstar'];
  return null;
}
V['privacy/threats'] = { title: 'Threat Models', render: function (s, q) {
  var cell = {}, max = 1, rowsUsed = {};
  P.openFindings().forEach(function (f) {
    var p = f.entities.filter(function (e) { return typeOf(e) === 'product'; })[0];
    if (!p) { var sys = f.entities.filter(function (e) { var t = typeOf(e); return t === 'system' || t === 'dataset'; })[0]; if (sys) p = P.get(sys).obj.product; }
    if (!p) p = SHARED;
    rowsUsed[p] = 1;
    uniq(f.linddun.map(function (l) { return LNORM[l] || l; })).forEach(function (l) { if (LIND.indexOf(l) < 0) return; var k = p + '|' + l; (cell[k] = cell[k] || []).push(f.id); max = Math.max(max, cell[k].length); });
  });
  var targets = NS.products.map(function (p) { return p.id; }).concat(rowsUsed[SHARED] ? [SHARED] : []);
  var sel = q.c ? q.c.split('|') : null;
  var h = '<div class="heat" style="grid-template-columns:minmax(76px,170px) repeat(7,minmax(28px,1fr))"><span></span>' + LIND.map(function (l) { return '<span class="hh"><abbr title="' + esc(l) + '">' + LCODE[l] + '</abbr></span>'; }).join('');
  targets.forEach(function (p) { h += '<span class="hr">' + esc(rowName(p)) + '</span>'; LIND.forEach(function (l) { var v = (cell[p + '|' + l] || []).length, a = v / max, alpha = 0.12 + a * 0.52; h += '<button class="hc" data-go="privacy/threats?c=' + encodeURIComponent(p + '|' + l) + '" style="background:' + (v ? 'rgba(196,45,73,' + alpha.toFixed(2) + ')' : 'var(--panel)') + ';color:' + (alpha >= 0.75 ? '#ffffff' : 'var(--text)') + (sel && sel[0] === p && sel[1] === l ? ';outline:2px solid var(--info)' : '') + '" aria-label="' + esc(rowName(p) + ' ' + l + ': ' + v) + '">' + (v || '') + '</button>'; }); });
  h += '</div>';
  var highs = P.openFindings().filter(function (f) { return f.sev === 'HIGH'; });
  var list = sel ? (cell[sel[0] + '|' + sel[1]] || []) : highs.map(function (f) { return f.id; }).slice(0, 5);
  var chains = list.map(function (id) {
    var f = P.get(id).obj, data = f.entities.filter(function (e) { return typeOf(e) === 'dataset'; })[0], sys = f.entities.filter(function (e) { return typeOf(e) === 'system'; })[0], ctl = f.entities.filter(function (e) { return typeOf(e) === 'control'; })[0];
    var th = sel ? sel[1] : (LNORM[f.linddun[0]] || f.linddun[0]), adv = adversaryOf(f);
    var stCls = /^(closed|mitigated)$/.test(f.status) ? 'good' : /^(open|blocking launch)$/.test(f.status) ? 'bad' : '';
    return '<div class="card flat" style="margin-bottom:10px"><div class="card-h"><b>' + esc(f.title) + '</b><span>' + P.sev(f.sev) + (adv ? ' <span class="tag" title="Adversary derived from the finding: ' + esc(adv[1]) + '">' + esc(adv[0]) + '</span>' : '') + '</span></div><div class="chain">' +
      [['Threat', (th || 'uncategorised') + ' — ' + f.kind, 'bad'], ['Data', data ? P.name(data) : '—', ''], ['System', sys ? P.name(sys) : '—', ''], ['Human harm', f.harms.join(', '), 'bad'], ['Control', ctl ? P.name(ctl) + ' (L' + P.get(ctl).obj.level + ')' : 'none', ctl ? '' : 'unk'], ['Owner', f.owner ? P.name(f.owner) : 'UNKNOWN', f.owner ? '' : 'unk'], ['Evidence', f.detector, ''], ['Status', f.status, stCls]].map(function (x) { return '<div class="cn ' + x[2] + '"><div class="cl">' + x[0] + '</div><div class="cv">' + esc(x[1]) + '</div></div>'; }).join('') + '</div>' + chip(id, 'Open ' + id) + '</div>';
  }).join('');
  var heading = sel ? esc(rowName(sel[0]) + ' · ' + sel[1]) : 'Highest-severity threat chains — ' + list.length + ' of ' + highs.length + ' open HIGH findings';
  return P.pageHead('Privacy', 'Privacy threat modelling — LINDDUN', 'Walk every category across every element of the data-flow diagram. Likely adversaries: outsider, partner, insider, tracker, and the future organisation (scope creep). Every threat connects to data, system, human harm, control, owner, evidence and status.') +
    '<div class="grid g-main"><div class="card"><div class="card-h"><h2 class="sec">Product × LINDDUN</h2><span class="sub">open findings per category · findings with no product sit in “Shared platform / vendors”</span></div>' + h + '</div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:8px">The seven categories</h2><ul class="checks small">' + [['Linking', 'Can items or actions be tied to the same person?'], ['Identifying', 'Can someone learn who the person is?'], ['Non-repudiation', 'Is a person unable to deny an action they would want to?'], ['Detecting', 'Can someone tell that data about a person exists?'], ['Data disclosure', 'Is personal data exposed more than necessary?'], ['Unawareness', 'Are people uninformed, or unable to act? (includes unintervenability)'], ['Non-compliance', 'Does it violate law, policy or promise?']].map(function (x) { return '<li><span class="ic mono">' + LCODE[x[0]] + '</span><span><b>' + x[0] + '</b> — <span class="muted">' + x[1] + '</span></span></li>'; }).join('') + '</ul></div></div>' +
    '<h2 class="sec" style="margin:18px 0 10px">' + heading + '</h2>' + (chains || '<p class="dim">No open findings in this cell.</p>');
} };
})();
