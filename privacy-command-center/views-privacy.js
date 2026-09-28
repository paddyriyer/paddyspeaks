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

/* ════════════ RISK RADAR ════════════ */
V['privacy/risks'] = { title: 'Risk Radar', render: function (s, q) {
  var rs = P.risksSorted(), sel = q.r && P.get(q.r) ? P.get(q.r).obj : rs[0];
  var head = NS.riskFactors.map(function (f) { return '<th title="' + esc(f.label) + '" class="rot"><span>' + esc(f.label.replace(' / regulatory exposure', '').replace('Ability to ', '')) + '</span></th>'; }).join('');
  var rows = rs.map(function (r) {
    var c = P.riskCalc(r);
    return '<tr class="click' + (r === sel ? ' sel' : '') + '" data-go="privacy/risks?r=' + r.id + '" tabindex="0"><td><b>' + esc(r.name) + '</b><div class="small dim mono">' + r.id + '</div></td><td class="num"><b>' + c.residual + '</b></td><td>' + P.sev(c.rating) + '</td>' + NS.riskFactors.map(function (f) { var v = r.f[f.k], as = f.kind === 'assurance'; var bg = as ? 'rgba(11,125,96,' + (0.08 + v / 5 * 0.6) + ')' : 'rgba(192,71,15,' + (0.06 + v / 5 * 0.7) + ')'; return '<td class="hm" style="background:' + bg + '">' + v + '</td>'; }).join('') + '</tr>';
  }).join('');
  return P.pageHead('Privacy', 'Executive privacy risk radar', 'No mysterious score. Nine exposure factors (coral) and three assurance factors (teal), each scored 0–5 with a stated reason; a deeper shade means a higher score. Residual = exposure × (1 − 0.6 × assurance). Click a row to see WHY.') +
    '<div class="tbl-wrap" style="margin-bottom:14px"><table class="tbl riskt"><thead><tr><th>Asset</th><th class="num">Residual</th><th>Rating</th>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    P.riskWhy(sel) + '<div class="btn-row">' + chip(sel.asset) + sel.findings.map(function (f) { return chip(f); }).join('') + '<a class="btn" href="#/report/executive?r=' + sel.id + '">Write the executive memo →</a></div>' +
    '<style>.riskt th.rot{height:92px;vertical-align:bottom;white-space:nowrap;padding:4px}.riskt th.rot span{display:inline-block;writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px}.riskt td.hm{text-align:center;font:600 12px var(--mono);padding:9px 4px;min-width:28px}.riskt tr.sel td{box-shadow:inset 0 1px 0 var(--info),inset 0 -1px 0 var(--info)}</style>';
} };

/* ════════════ WORST DAY — BREACH BUDGET ════════════ */
/* key custody: who could decrypt a stolen copy */
function custodyOf(s) { return /per-user|\bdevices?\b/i.test(s) ? 0.2 : /vault|separate/i.test(s) ? 0.55 : 1; }
function custodyLabel(c) { return c <= 0.2 ? 'per-user or device keys' : c <= 0.55 ? 'separate vault' : 'company-held'; }
/* vendors and subprocessors reachable from the dataset's system (or its parent
 * service) along flows that carry one of the dataset's fields */
function vendorCopies(d) {
  var names = d.fields.map(function (f) { return f[0]; });
  var carries = function (fl) { return fl.fields.some(function (x) { return x.split(/[^A-Za-z0-9_]+/).some(function (t) { return names.indexOf(t) >= 0; }); }); };
  var sys = P.get(d.system) ? P.get(d.system).obj : null, start = [d.system].concat(sys && sys.parent ? [sys.parent] : []);
  var seen = {}, queue = start.slice(), out = [];
  start.forEach(function (x) { seen[x] = 1; });
  while (queue.length) {
    var at = queue.shift();
    NS.flows.forEach(function (fl) { if (fl.from !== at || seen[fl.to] || !carries(fl)) return; seen[fl.to] = 1; if (isVendor(fl.to)) out.push(fl.to); queue.push(fl.to); });
  }
  return out;
}
function wdAsset(w) {
  var d = P.get(w.ds).obj, risk = NS.risks.filter(function (r) { return r.asset === d.id; })[0], v = vendorCopies(d);
  return { d: d, risk: risk, people: d.people, fields: d.fields.length, sens: P.dsTier(d), days: d.age, ident: risk ? risk.f.ident : null, link: risk ? risk.f.link : null,
    key: d.keyOwner, custody: custodyOf(d.keyOwner + ' ' + d.encryption), vendors: v.length, vendorIds: v, infer: w.infer };
}
function ext(a, o) { var r = {}; Object.keys(a).forEach(function (k) { r[k] = a[k]; }); Object.keys(o).forEach(function (k) { r[k] = o[k]; }); return r; }
var DESIGNS = [
  ['CURRENT', 'Current design', 'as built today', function (a) { return a; }],
  ['MINIMIZED', 'Minimised', 'fewer fields: −1 tier, −1 linkability, one fewer vendor copy', function (a) { return ext(a, { fields: Math.max(2, Math.round(a.fields * 0.45)), sens: Math.max(1, a.sens - 1), link: Math.max(1, a.link - 1), vendors: Math.max(0, a.vendors - 1) }); }],
  ['SHORT RETENTION', 'Short retention', 'nothing older than 30 d', function (a) { return ext(a, { days: Math.min(a.days, 30) }); }],
  ['TOKENIZED', 'Tokenised', '−2 identifiability, −2 linkability; keys move to a separate vault unless custody is already stronger', function (a) { return ext(a, { ident: Math.max(1, a.ident - 2), link: Math.max(1, a.link - 2), key: a.custody <= 0.55 ? a.key : 'token vault (separate team)', custody: Math.min(a.custody, 0.55) }); }],
  ['ISOLATED', 'Isolated + per-user keys', 'a breach reaches 20% of people; linkability 1; no vendor copies; per-user keys', function (a) { return ext(a, { people: a.people * 0.2, link: 1, vendors: 0, key: a.custody <= 0.2 ? a.key : 'per-user keys (HSM)', custody: Math.min(a.custody, 0.2) }); }],
  ['ON-DEVICE', 'On-device', 'nothing held on the server', function () { return { people: 0, fields: 0, sens: 0, days: 0, ident: 0, link: 0, key: 'the person\'s device', custody: 0.2, vendors: 0 }; }]
];
P.state.worst = P.state.worst || (NS.worstDay[0] && NS.worstDay[0].ds);
/* DAMAGE = collected × kept × identifiable × key — the same four terms as the headline */
function damage(a) {
  if (!a.people) return { collected: 0, kept: 0, ident: 0, key: 0, total: 0 };
  var identS = a.ident == null ? 5 : a.ident, linkS = a.link == null ? 5 : a.link;
  var collected = Math.log10(a.people + 1) * (a.sens + 1), kept = Math.max(0.2, Math.log10((a.days || 0) + 1) / 2.7), ident = (identS + 1) * (1 + linkS / 5), key = a.custody * (1 + 0.25 * a.vendors);
  return { collected: collected, kept: kept, ident: ident, key: key, total: collected * kept * ident * key };
}
function f2(x) { return (Math.round(x * 100) / 100).toString(); }
V['privacy/worstday'] = { title: 'Worst Day', render: function () {
  var ids = NS.worstDay.map(function (w) { return w.ds; });
  if (ids.indexOf(P.state.worst) < 0) P.state.worst = ids[0];
  var id = P.state.worst, a = wdAsset(NS.worstDay[ids.indexOf(id)]), d = a.d;
  var base = damage(a), bt = base.total;
  var cols = DESIGNS.map(function (x) {
    var b = x[3](a), dm = damage(b).total, rel = bt ? dm / bt : 0, r = Math.min(110, 14 + 96 * Math.sqrt(rel)), pctTxt = Math.round(rel * 100) + '%';
    var col = rel > 0.6 ? '#c42d49' : rel > 0.25 ? '#c0470f' : rel > 0.02 ? '#946300' : '#0b7d60';
    var label = r >= 40 ? '<text x="120" y="129" fill="#1d2430" font-size="26" font-weight="700" text-anchor="middle">' + pctTxt + '</text>' : '<text x="120" y="' + (120 + r + 28).toFixed(1) + '" fill="#1d2430" font-size="24" font-weight="700" text-anchor="middle">' + pctTxt + '</text>';
    return '<div class="wd-col' + (x[0] === 'CURRENT' ? ' cur' : '') + '"><div class="mono small dim">' + x[0] + '</div><svg viewBox="0 0 240 240" width="100%" style="max-width:220px" role="img" aria-label="' + esc(x[1]) + ' blast radius ' + Math.round(rel * 100) + ' percent of today"><circle cx="120" cy="120" r="112" fill="none" stroke="#e7e1d5" stroke-dasharray="2 5"/><circle cx="120" cy="120" r="' + r.toFixed(1) + '" fill="' + col + '" fill-opacity=".22" stroke="' + col + '"/>' + label + '</svg>' +
      '<div class="small dim wd-rule">' + esc(x[2]) + '</div>' +
      '<ul class="wd-l"><li><span>people</span><b>' + (b.people ? fmtN(Math.round(b.people)) : '0') + '</b></li><li><span>oldest</span><b>' + (b.days ? fmtDays(b.days) : '—') + '</b></li><li><span>sensitivity</span><b>' + (b.sens ? 'T' + b.sens : '—') + '</b></li><li><span>identifiable</span><b>' + (b.ident == null ? unk() : b.ident + '/5') + '</b></li><li><span>linkable</span><b>' + (b.link == null ? unk() : b.link + '/5') + '</b></li><li><span>vendors w/ copies</span><b>' + b.vendors + '</b></li><li><span>key holder</span><b class="small">' + esc(b.key) + '</b></li></ul></div>';
  }).join('');
  var rk = a.risk ? ' <span class="small dim">(risk ' + chip(a.risk.id, a.risk.id) + ')</span>' : '';
  return P.pageHead('Privacy · show me my worst day', 'The breach budget', 'You can’t promise zero. You can decide, before launch, the most a failure could ever cost. <span class="mono small">DAMAGE = WHAT YOU COLLECTED × HOW LONG YOU KEPT IT × HOW IDENTIFIABLE × WHO HOLDS THE KEY</span>') +
    '<div class="toolbar"><label class="small muted" for="wdSel">If this were compromised today:</label><select id="wdSel">' + ids.map(function (k) { return '<option value="' + k + '"' + (k === id ? ' selected' : '') + '>' + esc(P.get(k).obj.name) + ' — ' + esc(P.name(P.get(k).obj.system)) + '</option>'; }).join('') + '</select></div>' +
    '<div class="grid g-main" style="margin-bottom:14px"><div class="card"><h2 class="sec" style="margin-bottom:10px">What an attacker, a subpoena or a new product idea could reach</h2>' + P.kv([
      ['Personal data exposed', d.fields.map(function (f) { return '<span class="mono small">' + esc(f[0]) + '</span>'; }).join(', ')], ['How old', d.age == null ? unk() : fmtDays(d.age)], ['How sensitive', P.tier(a.sens)],
      ['How identifiable', (a.ident == null ? unk() : a.ident + ' / 5') + ' — ' + P.dsIds(d).map(P.name).map(esc).join(', ') + rk], ['How linkable', (a.link == null ? unk() : a.link + ' / 5') + rk], ['People affected', fmtN(d.people)],
      ['Who holds the keys', esc(d.keyOwner) + ' <span class="small dim">(' + custodyLabel(a.custody) + ')</span>'],
      ['Vendors with copies', (a.vendors ? P.chips(a.vendorIds) : 'none') + '<div class="small dim">Rule: vendors and subprocessors reachable from ' + esc(P.name(d.system)) + ' (or its parent service) along flows that carry one of this dataset’s fields.</div>'],
      ['What can be inferred', a.infer.map(function (x) { return '<span class="warn">' + esc(x) + '</span>'; }).join(' · ')]]) + '</div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:8px">The same event, six designs</h2><p class="small muted">Each column applies one architectural change to the current design. The ring is the blast radius relative to today.</p>' +
      '<p class="mono small dim" style="margin:8px 0">Today: collected ' + f2(base.collected) + ' × kept ' + f2(base.kept) + ' × identifiable ' + f2(base.ident) + ' × key ' + f2(base.key) + ' = ' + f2(base.total) + '</p>' +
      '<div class="callout" style="margin-top:10px">The only data that can’t be subpoenaed, breached, or sold is data you never kept.</div>' + P.chip(id, 'Open the passport') + '</div></div>' +
    '<div class="wd">' + cols + '</div>' +
    '<p class="small dim" style="margin-top:10px">Illustrative model, with the same four terms as the headline. <span class="mono">collected</span> = log₁₀(people) × (tier + 1) · <span class="mono">kept</span> = max(0.2, log₁₀(days + 1) ÷ 2.7) · <span class="mono">identifiable</span> = (identifiability + 1) × (1 + linkability ÷ 5), both scores from the asset’s Risk Radar entry · <span class="mono">key</span> = custody × (1 + 0.25 × vendors with copies), custody 1 company-held, 0.55 separate vault, 0.2 per-user or device keys. Architecture changes the blast radius more than any policy.</p>' +
    '<style>.wd{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.wd-col{border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--panel);text-align:center}.wd-col.cur{border-color:rgba(192,71,15,.5)}.wd-rule{min-height:3.2em;margin:2px 0 4px;line-height:1.35}.wd-l{list-style:none;padding:0;margin:6px 0 0;text-align:left;font-size:12px}.wd-l li{display:flex;justify-content:space-between;gap:6px;padding:3px 0;border-bottom:1px solid var(--line)}.wd-l span{color:var(--dim)}@media(max-width:1100px){.wd{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:600px){.wd{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>';
}, mount: function (root) { root.querySelector('#wdSel').addEventListener('change', function () { P.state.worst = this.value; P._keepScroll = true; P.render(); }); } };

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

/* ════════════ PURPOSE LIMITATION ════════════ */
/* every observed use of a dataset, by purpose:
 *  · flows leaving its system (their declared purpose)
 *  · flows flagged purpose_change: the purposes their recipient holds data for
 *  · models trained on it (the model's purpose)
 *  · PURPOSE DRIFT findings: the purposes of the flows / other datasets they cite */
function purposeUses() {
  var use = {};
  function add(ds, p, ent, why, find) { var u = (use[ds] = use[ds] || {}); (u[p] = u[p] || []).push({ ent: ent, why: why, find: find || null }); }
  NS.datasets.forEach(function (d) {
    NS.flows.filter(function (f) { return f.from === d.system; }).forEach(function (f) {
      add(d.id, f.purpose, f.id, 'flow to ' + P.name(f.to));
      if ((f.flags || []).indexOf('purpose_change') >= 0) NS.datasets.filter(function (x) { return x.system === f.to; }).forEach(function (x) { x.purposes.forEach(function (p) { if (d.purposes.indexOf(p) < 0) add(d.id, p, f.id, 'recipient ' + P.name(f.to) + ' holds ' + x.name + ' for ' + p); }); });
    });
    NS.models.filter(function (m) { return m.training.indexOf(d.id) >= 0; }).forEach(function (m) { add(d.id, m.purpose, m.id, 'trains ' + m.name); });
  });
  NS.findings.filter(function (f) { return /PURPOSE DRIFT/.test(f.kind) && isOpen(f); }).forEach(function (f) {
    var dss = f.entities.filter(function (e) { return typeOf(e) === 'dataset'; }), src = dss[0]; if (!src) return;
    var ps = f.entities.filter(function (e) { return typeOf(e) === 'flow'; }).map(function (e) { return P.get(e).obj.purpose; }).concat([].concat.apply([], dss.slice(1).map(function (x) { return P.get(x).obj.purposes; })));
    uniq(ps).forEach(function (p) { add(src, p, f.id, f.id + ' · ' + f.title, f.id); });
  });
  return use;
}
function driftFindingsFor(uses) { return uniq([].concat.apply([], (uses || []).map(function (u) { return u.find ? [u.find] : []; }))); }
V['privacy/purpose'] = { title: 'Purpose', render: function () {
  var use = purposeUses(), drifts = NS.findings.filter(function (f) { return /PURPOSE DRIFT/.test(f.kind) && isOpen(f); });
  var mat = NS.datasets.filter(function (d) { return P.dsTier(d) >= 2; });
  var cols = NS.purposes.map(function (p) { return { id: p.id, label: p.label }; }).concat([{ id: 'unknown', label: 'Unknown purpose' }]);
  var grid = '<div class="tbl-wrap"><table class="tbl pm"><thead><tr><th>Dataset</th>' + cols.map(function (p) { return '<th class="rot" title="' + esc(p.id) + '"><span>' + esc(p.label) + '</span></th>'; }).join('') + '</tr></thead><tbody>' + mat.map(function (d) {
    return '<tr><td>' + chip(d.id) + (d.purposes.length ? '' : '<div class="small">' + unk('no declared purpose') + '</div>') + '</td>' + cols.map(function (p) {
      var dec = d.purposes.indexOf(p.id) >= 0, us = use[d.id] && use[d.id][p.id], fnd = driftFindingsFor(us);
      var cls = p.id === 'unknown' ? (us ? 'unk' : '') : fnd.length || (us && !dec) ? 'drift' : dec && us ? 'ok' : dec ? 'dec' : '';
      var sym = cls === 'unk' ? '?' : cls === 'drift' ? '✗' : cls === 'ok' ? '●' : cls === 'dec' ? '○' : '';
      var tip = (dec ? 'declared' : 'not declared') + (us ? ' · used: ' + us.map(function (u) { return u.why; }).join('; ') : '');
      var target = fnd[0] || (us && us[0].ent);
      return '<td class="pc ' + cls + '"' + (target ? ' data-ent="' + target + '" role="button" tabindex="0" aria-label="' + esc(d.name + ' × ' + p.label + ': ' + tip) + '"' : '') + ' title="' + esc(tip) + '">' + sym + '</td>';
    }).join('') + '</tr>';
  }).join('') + '</tbody></table></div>';
  var cards = drifts.map(function (f) {
    var src = f.entities.filter(function (e) { return typeOf(e) === 'dataset'; })[0], d = src ? P.get(src).obj : null;
    if (!d) return '<div class="card">' + chip(f.id, f.id) + ' ' + unk('no source dataset recorded') + '</div>';
    var tokens = [].concat.apply([], f.entities.filter(function (e) { return typeOf(e) === 'flow'; }).map(function (e) { return P.get(e).obj.fields; }).concat(f.entities.filter(function (e) { return typeOf(e) === 'dataset' && e !== src; }).map(function (e) { return P.get(e).obj.fields.map(function (x) { return x[0]; }); }))).join(' ');
    var fields = d.fields.filter(function (x) { return x[2] !== 'attr' || x[1] >= 3; }).filter(function (x) { return tokens.indexOf(x[0]) >= 0; }).map(function (x) { return x[0]; });
    if (!fields.length) fields = d.fields.filter(function (x) { return x[1] >= 3; }).map(function (x) { return x[0]; });
    var u = use[d.id] || {};
    var lines = Object.keys(u).map(function (p) {
      var fnd = driftFindingsFor(u[p]), dec = d.purposes.indexOf(p) >= 0, ok = p === 'unknown' ? null : !fnd.length && dec;
      var ents = uniq(u[p].map(function (x) { return x.ent; })).filter(function (e) { return e !== f.id && fnd.indexOf(e) < 0; });
      return P.check(ok, '<b>' + esc(P.get(p) ? P.get(p).obj.label : p) + '</b>' + (dec ? ' <span class="small dim">declared</span>' : ' <span class="small bad">not declared</span>') + ' ' + ents.map(function (e) { return chip(e); }).join(' ') + fnd.map(function (x) { return ' ' + chip(x, x); }).join(''));
    }).join('');
    return '<div class="card"><div class="card-h" style="margin-bottom:6px"><span class="mono" style="font-size:13px">' + esc(fields.join(' · ') || d.name) + '</span>' + P.sev(f.sev) + '</div><div class="small muted" style="margin-bottom:8px">' + esc(f.title) + '</div><div class="small dim" style="margin:4px 0 10px">ORIGINAL PURPOSE ' + (d.purposes.length ? d.purposes.map(function (p) { return '<span class="tag sev-GOOD">' + esc(p) + '</span>'; }).join(' ') : unk('none declared')) + '</div><div class="small dim" style="margin-bottom:4px">CURRENT USES</div><ul class="checks pv-uses">' + lines + '</ul><div class="tag sev-HIGH" style="margin-top:10px">PURPOSE DRIFT DETECTED</div><div style="margin-top:8px">' + chip(d.id) + ' ' + chip(f.id, f.id) + '</div></div>';
  }).join('');
  return P.pageHead('Privacy', 'Purpose limitation engine', 'Data carries its purpose with it, and every new use has to show its ticket. Purpose is evaluated when data is <b>used</b>, not merely when it is collected.') +
    '<p class="small dim" style="margin:0 0 10px">One card per open PURPOSE DRIFT finding (' + drifts.length + '). Uses come from flows leaving the dataset’s system, the recipients of flows flagged as a purpose change, models trained on it, and the findings themselves.</p>' +
    '<div class="grid g3" style="margin-bottom:14px">' + cards + '</div>' +
    '<div class="card"><div class="card-h"><h2 class="sec">Declared vs actual use</h2><span class="sub">○ declared · ● declared and used · <span class="bad">✗ used without declaration, or flagged by a purpose-drift finding</span> · <span class="unknown">? used for an unknown purpose</span></span></div>' + grid + '</div>' +
    '<div class="callout" style="margin-top:14px">Four questions for every new use: What did the person understand? What was the original purpose (in metadata, not memory)? Did the purpose change — a new purpose needs a new basis? Can they revoke, and does revocation reach every copy? Enforcement today: ' + chip('c_purpose_runtime') + ' runs at query time for Pulse only; everywhere else it is ' + chip('c_purpose_fs') + ' — a human approval.</div>' +
    '<style>.pm th.rot{height:140px;vertical-align:bottom;padding:4px;text-transform:none;letter-spacing:0}.pm th.rot span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:11px;white-space:nowrap}.pm td.pc{text-align:center;font-size:13px;min-width:30px}.pm td.pc.ok{color:var(--ctl)}.pm td.pc.dec{color:var(--dim)}.pm td.pc.drift{color:var(--exp);background:rgba(192,71,15,.12);cursor:pointer;font-weight:700}.pm td.pc.unk{color:var(--unk);outline:1px dashed rgba(99,70,201,.6);outline-offset:-3px;cursor:pointer;font-weight:700}</style>';
} };

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

/* ════════════ AI / ML ════════════ */
/* where the model actually runs: an outside provider makes it a third-party model, whatever the record says */
function hostingOf(m) { return m.provider !== 'in-house' && m.hosting !== 'ON DEVICE' ? 'THIRD-PARTY MODEL' : m.hosting; }
V['privacy/ai'] = { title: 'AI / ML', render: function () {
  var arch = ['ON DEVICE', 'ISOLATED PRIVATE CLOUD', 'INTERNAL CLOUD', 'THIRD-PARTY MODEL'];
  var AC = { 'ON DEVICE': '#0b7d60', 'ISOLATED PRIVATE CLOUD': '#1f6ac0', 'INTERNAL CLOUD': '#7a5200', 'THIRD-PARTY MODEL': '#b3400b' };
  var ai8 = [['Purpose', 'Collected to run a feature; now useful to train a model.'], ['Deletion', 'You can delete a row; not easily what a model learned from it.'], ['Consent', 'Permission to post was never permission to train.'], ['Inference', 'Models guess what you never shared.'], ['Context', 'A helpful assistant needs mail, messages and calendar in one place.'], ['Boundaries', 'Permissions were per app; an agent acts across all of them.'], ['Input = command', 'A page or email can carry instructions that make an agent leak.'], ['Retention', 'Prompts are records.']];
  return P.pageHead('Privacy', 'AI / ML privacy center', 'Every AI and ML system, where it thinks, what leaves, what is kept, and whether it can forget. On device when it can, verifiable private cloud when it must, an outside model only when the person says yes. A model whose provider is outside Northstar is filed as third-party, whatever its record says.') +
    '<div class="archbar">' + arch.map(function (a) { var ms = NS.models.filter(function (m) { return hostingOf(m) === a; }), moved = NS.models.filter(function (m) { return m.hosting === a && hostingOf(m) !== a; }); return '<div class="ab" style="border-top:3px solid ' + AC[a] + '"><div class="mono small" style="color:' + AC[a] + '">' + a + '</div><div class="small dim" style="margin:2px 0 8px">' + { 'ON DEVICE': 'Nothing leaves the phone', 'ISOLATED PRIVATE CLOUD': 'Sealed servers you can check', 'INTERNAL CLOUD': 'The company can see it, by policy', 'THIRD-PARTY MODEL': 'The provider can see it, by contract' }[a] + '</div>' + (ms.length ? ms.map(function (m) { return chip(m.id); }).join('') : '<span class="dim small">—</span>') + moved.map(function (m) { return '<div class="small">' + unk('recorded here: ' + m.name) + ' <span class="dim">— runs on ' + esc(m.provider) + '</span></div>'; }).join('') + '</div>'; }).join('') + '</div>' +
    '<div class="grid g2" style="margin:14px 0">' + NS.models.map(function (m) {
      var f = P.findingsFor(m.id), h = hostingOf(m), mis = h !== m.hosting;
      var delF = f.filter(function (x) { return isOpen(x) && /UNKNOWN RETENTION|DELETION/.test(x.kind); });
      var path = m.deletionPath, delCell = /unknown/.test(path) ? unk() : /^none/.test(path) ? '<span class="bad">' + esc(path) + '</span>' + (delF.length ? ' ' + delF.map(function (x) { return chip(x.id, x.id); }).join(' ') : '') : delF.length ? '<span class="warn">recorded: ' + esc(path) + '</span> ' + unk('unconfirmed — ' + delF.map(function (x) { return x.id; }).join(', ')) : esc(path);
      var third = m.thirdParty.filter(function (v) { return P.get(v); });
      return '<div class="card"><div class="card-h"><div><button class="chip" data-ent="' + m.id + '" style="font-size:14px;font-weight:650;color:var(--text)">' + esc(m.name) + '</button><div class="small dim" style="margin-top:4px">' + esc(m.provider) + ' · ' + esc(P.name(m.team)) + '</div></div><span class="tag" style="color:' + AC[h] + ';border-color:' + AC[h] + '">' + esc(h) + '</span></div>' +
        (mis ? '<div class="callout unk" style="margin:6px 0 8px;padding:8px 10px">' + unk('Hosting record disagrees') + ' Recorded as ' + esc(m.hosting) + ', but the model runs on ' + esc(m.provider) + ' (third party).</div>' : '') +
        P.kv([['Training data', m.training.length ? P.chips(m.training) : '—'], ['Third parties', third.length ? P.chips(third) : 'none'], ['Provenance', m.provenance === 'documented' ? '<span class="ok">documented</span>' : m.provenance === 'unknown' ? unk() : '<span class="warn">partial</span>'], ['Prompt logging', /full/.test(m.promptLogging) ? '<span class="bad">' + esc(m.promptLogging) + '</span>' : esc(m.promptLogging)], ['Trains on user input', m.trainsOnUserInput == null ? unk() : m.trainsOnUserInput ? (m.hosting === 'ON DEVICE' ? 'yes — federated, DP' : '<span class="bad">yes</span>') : 'no'], ['Deletion path', delCell], ['Memorisation testing', /not tested/.test(m.memorization) ? '<span class="bad">not tested</span>' : esc(m.memorization)], ['Review', esc(m.review)]]) +
        (f.length ? '<div style="margin-top:8px">' + f.map(function (x) { return chip(x.id, x.id); }).join(' ') + '</div>' : '') + '</div>';
    }).join('') + '</div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:10px">AI breaks eight assumptions privacy was built on</h2><div class="grid g4">' + ai8.map(function (x, i) { return '<div><div class="mono small dim">' + (i + 1) + ' · ' + esc(x[0].toUpperCase()) + '</div><div class="small">' + esc(x[1]) + '</div></div>'; }).join('') + '</div></div>' +
    '<style>.archbar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ab{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:flex-start;gap:4px}@media(max-width:860px){.archbar{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>';
} };

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
