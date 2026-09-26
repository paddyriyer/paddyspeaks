/* Views: Privacy (Reviewer + Builder work). */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk, fmtDays = P.fmtDays, uniq = P.uniq;
var V = P.views;

/* ── small shared helpers ─────────────────────────────────── */
function pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
/* nearest-rank percentile: always a value that is actually in the data */
function nearestRank(arr, q) { var a = arr.filter(function (x) { return x != null; }).sort(function (x, y) { return x - y; }); if (!a.length) return null; return a[Math.max(0, Math.ceil(q * a.length) - 1)]; }
function typeOf(id) { var e = P.get(id); return e ? e.type : null; }
function isVendor(id) { var t = typeOf(id); return t === 'vendor' || t === 'subprocessor'; }
function isOpen(f) { return f.status !== 'accepted' && f.status !== 'closed' && f.status !== 'mitigated'; }
/* a chart that keeps readable type on a phone: fixed min width, scrolls sideways */
function scrollFig(label, svg) { return '<div class="pv-scroll" tabindex="0" role="region" aria-label="' + esc(label) + '">' + svg + '</div>'; }
/* stat tiles that carry their rule */
function statRow(stats, cls) { return '<div class="stat-row pv-stats' + (cls ? ' ' + cls : '') + '">' + stats.map(function (x) { return '<div class="stat"><div class="sv' + (x[3] ? ' ' + x[3] : '') + '">' + x[1] + '</div><div class="sl">' + esc(x[0]) + '</div><div class="sr">' + esc(x[2]) + '</div></div>'; }).join('') + '</div>'; }
/* keep an SVG label inside the viewBox: flip to the left of x when it would overflow */
function svgLabel(x, y, text, W, fill, size) { var w = text.length * size * 0.6, right = x + 9 + w <= W - 2; return '<text x="' + (right ? x + 9 : x - 9).toFixed(1) + '" y="' + y + '" fill="' + fill + '" font-size="' + size + '" text-anchor="' + (right ? 'start' : 'end') + '">' + esc(text) + '</text>'; }

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
var BLOCKER_RULE = 'Open findings (not closed, mitigated or accepted) touching the feature, its systems, datasets or flows, with severity HIGH or status “blocking launch”.';
function blockerText(n, stage) { return stage === 'POST-LAUNCH AUDIT' ? pl(n, 'open post-launch blocker') : pl(n, 'launch blocker'); }
/* repeat finding: an open finding whose failure family already appeared, in an earlier finding, on the same dataset or system */
var FAMILY = [['purpose', /PURPOSE/], ['retention', /RETENTION|TTL|LONG-LIVED|OUTLIVES/], ['consent', /CONSENT/], ['deletion', /DELETION/], ['linkability', /LINKAB|LINKAGE/], ['unknown', /UNKNOWN/], ['agreement', /AGREEMENT/], ['egress', /EGRESS|SUBPROCESSOR|VENDOR/], ['logging', /LOG/], ['access', /ACCESS/]];
function families(k) { return FAMILY.filter(function (x) { return x[1].test(k); }).map(function (x) { return x[0]; }); }
function repeatFindings() {
  return P.openFindings().filter(function (f) {
    var fam = families(f.kind);
    return NS.findings.some(function (g) { return g !== f && g.opened < f.opened && families(g.kind).some(function (x) { return fam.indexOf(x) >= 0; }) && g.entities.some(function (e) { var t = typeOf(e); return (t === 'dataset' || t === 'system') && f.entities.indexOf(e) >= 0; }); });
  });
}
V['privacy/reviews'] = { title: 'Reviews', render: function (s) {
  if (s[0] && P.get(s[0])) return workbench(s[0]);
  var cols = NS.reviewStages.map(function (st) {
    var rs = NS.reviews.filter(function (r) { return r.stage === st; });
    return '<div class="kcol"><div class="kh"><span class="mono small">' + st + '</span><span class="mono small dim">' + rs.length + '</span></div>' + rs.map(function (r) {
      var nb = P.reviewBlockers(r.feature).length;
      return '<a class="kc" href="#/privacy/reviews/' + r.feature + '"><div style="display:flex;justify-content:space-between;gap:6px">' + P.sev(r.risk) + '<span class="mono small dim">' + r.id + '</span></div><div style="font-weight:600;margin:6px 0 2px">' + esc(P.name(r.feature)) + '</div><div class="small muted">' + r.age + ' d · ' + (r.reviewer ? esc(r.reviewer) : '<span class="unknown">no reviewer</span>') + '</div>' + (nb ? '<div class="small bad">' + blockerText(nb, r.stage) + '</div>' : '') + (r.drift ? '<div class="small warn">post-launch drift</div>' : '') + '</a>';
    }).join('') + '</div>';
  }).join('');
  var waiting = NS.reviews.filter(function (r) { return ['INTAKE', 'TRIAGE', 'DESIGN REVIEW'].indexOf(r.stage) >= 0; });
  var blocked = NS.reviews.filter(function (r) { return r.stage !== 'POST-LAUNCH AUDIT' && P.reviewBlockers(r.feature).length; });
  var rep = repeatFindings();
  var stats = [
    ['Reviews waiting', waiting.length, 'Reviews in intake, triage or design review.'],
    ['Median review age', Math.round(P.quantile(NS.reviews.map(function (r) { return r.age; }), 0.5)) + ' d', 'Median days open, all reviews.'],
    ['High-risk launches', NS.reviews.filter(function (r) { return r.risk === 'HIGH' && ['BUILD CHECK', 'LAUNCH GATE'].indexOf(r.stage) >= 0; }).length, 'HIGH-risk reviews at build check or launch gate.'],
    ['Blocked launches', blocked.length, 'Pre-launch reviews with at least one blocker (same rule as the workbench).', blocked.length ? 'bad' : ''],
    ['Post-launch drift', NS.reviews.filter(function (r) { return r.drift; }).length, 'Live features whose data use changed after review.'],
    ['Repeat findings', rep.length, 'Open findings whose failure type already appeared, in an earlier finding, on the same dataset or system' + (rep.length ? ': ' + rep.map(function (f) { return f.id; }).join(', ') : '') + '.']
  ];
  return P.pageHead('Privacy', 'Privacy review operating model', 'Intake → triage → design review → build check → launch gate → post-launch audit. <b>LOW</b> is self-service with automated checks; <b>MEDIUM</b> gets an expert review; <b>HIGH</b> gets a full threat model, engineering review and senior sign-off.') +
    '<div class="card" style="margin-bottom:14px">' + statRow(stats) + '<p class="small dim" style="margin:10px 0 0">Blocker rule: ' + esc(BLOCKER_RULE) + '</p></div>' +
    '<div class="kanban">' + cols + '</div>' +
    '<style>.kanban{display:grid;grid-template-columns:repeat(6,minmax(170px,1fr));gap:10px;overflow-x:auto;padding-bottom:6px}.kcol{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:8px;min-height:200px}.kh{display:flex;justify-content:space-between;padding:4px 4px 6px;border-bottom:1px solid var(--line)}.kc{display:block;text-decoration:none;color:var(--text);background:var(--panel);border:1px solid var(--line2);border-radius:10px;padding:10px}.kc:hover{border-color:var(--line3)}</style>';
} };
function workbench(fid) {
  var f = P.get(fid).obj, r = NS.reviews.filter(function (x) { return x.feature === fid; })[0], q = NS.eightQ[fid];
  var S = featureScope(fid), ds = S.ds, flows = S.flows, finds = S.finds, blockers = S.blockers;
  var nodeIds = S.sysIds.concat(S.models.map(function (m) { return m.id; }));
  var ids = uniq([].concat.apply([], ds.map(P.dsIds)));
  var vendors = uniq(flows.map(function (x) { return x.to; }).filter(isVendor));
  var lind = uniq([].concat.apply([], finds.map(function (x) { return x.linddun; })));
  var harms = uniq([].concat.apply([], finds.map(function (x) { return x.harms; })));
  var noLineage = !S.sysIds.length && !S.models.length;
  var openQ = []; if (q) Object.keys(q).forEach(function (k) { if (!q[k]) openQ.push('Question ' + k + ' has no answer yet — unknown, and therefore a finding.'); });
  ds.forEach(function (d) { P.six(d).why.forEach(function (w) { openQ.push(d.name + ': ' + w[1]); }); });
  var tc = []; ds.forEach(function (d) { P.tierControls(d).forEach(function (c) { if (c[1] !== true) tc.push('<b>' + esc(d.name) + '</b> — ' + esc(c[0])); }); });
  var purposes = uniq([].concat.apply([], ds.map(function (d) { return d.purposes; })).concat(flows.map(function (x) { return x.purpose; })).concat(S.models.map(function (m) { return m.purpose; })).filter(function (p) { return P.get(p); }));
  var QS = ['VALUE', 'DATA', 'IDENTITY', 'FLOW', 'ACCESS', 'TIME', 'MISUSE', 'REDUCE'];
  var RF = { VALUE: '“We might need it later.”', DATA: 'Free text, full URLs, raw payloads.', IDENTITY: 'A durable ID shared across features.', FLOW: 'Unlisted SDKs, logs, exports.', ACCESS: 'Warehouse-wide read by default.', TIME: 'No TTL, or “until deleted.”', MISUSE: 'Security data readable by ads.', REDUCE: 'Controls that live only in a doc.' };
  var edges = flows.concat(S.train);
  var diagram = edges.length ? miniDFD(nodeIds, edges) : '<div style="padding:18px">' + unk('No lineage recorded for this feature') + '<p class="small dim" style="margin:8px 0 0">No system, dataset, flow or model is registered against it, so nothing can be drawn — and nothing can be proven about where its data goes.</p></div>';
  var noData = unk('No datasets registered for this feature');
  var post = r && r.stage === 'POST-LAUNCH AUDIT';
  var blockMsg = post ? ' — the feature is live: these stay open post-launch blockers, and the audit cannot close until they do.' : ' — the launch gate refuses sign-off until these close.';
  return P.pageHead('Privacy · review workbench', f.name, chip(f.product) + ' · status ' + esc(f.status) + (r ? ' · review <span class="mono">' + r.id + '</span> ' + esc(r.stage) + ' ' + P.sev(r.risk) : ' · ' + unk('NO REVIEW'))) +
    (blockers.length ? '<div class="callout warn" style="margin-bottom:14px"><b>' + blockerText(blockers.length, r && r.stage) + '.</b> ' + blockers.map(function (b) { return chip(b.id, b.id); }).join(' ') + esc(blockMsg) + '</div>' : noLineage ? '<div class="callout unk" style="margin-bottom:14px">' + unk('Blockers cannot be assessed') + ' — no lineage is recorded, so no finding can attach to this feature.</div>' : '<div class="callout" style="margin-bottom:14px">No findings block launch.</div>') +
    '<div class="grid g-main"><div>' +
      '<div class="card" style="margin-bottom:14px"><div class="card-h"><h2 class="sec">Data-flow diagram (auto-built from lineage)</h2><span class="sub">' + pl(flows.length, 'flow') + (S.train.length ? ' · ' + pl(S.train.length, 'training link') : '') + (S.models.length ? ' · ' + pl(S.models.length, 'model') : '') + '</span></div><div class="canvas"' + (edges.length ? ' tabindex="0" role="region" aria-label="Feature data-flow diagram"' : '') + '>' + diagram + '</div>' + (S.viaTeam ? '<p class="small dim" style="margin:8px 0 0">Models linked through the product team (no system is registered to this feature): ' + S.models.map(function (m) { return chip(m.id); }).join(' ') + '</p>' : '') + '</div>' +
      '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:10px">The universal 8-question review</h2><div class="tbl-wrap"><table class="tbl"><tbody>' + QS.map(function (k, i) { var a = q && q[k]; return '<tr><td class="nowrap"><span class="mono small dim">' + (i + 1) + '</span> <b>' + k + '</b></td><td>' + (q ? (a ? esc(a) : unk('UNKNOWN — this is a finding')) : unk('not yet answered')) + '<div class="small dim" style="margin-top:3px">Red flag: ' + esc(RF[k]) + '</div></td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="card"><h2 class="sec" style="margin-bottom:10px">Findings</h2>' + (finds.length || !noLineage ? P.passportHelpers.findingsList(finds) : unk('No lineage — findings cannot attach')) + '</div>' +
    '</div><div>' +
      '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:8px">Data inventory</h2>' + (ds.length ? ds.map(function (d) { return '<div style="margin-bottom:8px">' + chip(d.id) + ' ' + P.tier(P.dsTier(d)) + P.sixStrip(P.six(d)) + '</div>'; }).join('') : noData) + '</div>' +
      '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:8px">Identifiers · purposes · vendors</h2>' + P.kv([['Identifiers', ids.length ? P.chips(ids) : ds.length ? '—' : unk()], ['Purposes', purposes.length ? P.chips(purposes) : unk('no declared purpose')], ['Models', S.models.length ? P.chips(S.models.map(function (m) { return m.id; })) : 'none registered'], ['Consent', ds.length ? uniq(ds.map(function (d) { return d.consent; })).map(esc).join('<br>') : unk()], ['Vendors', vendors.length ? P.chips(vendors) : noLineage ? unk() : 'none'], ['Retention', ds.length ? ds.map(function (d) { return esc(d.name) + ': ' + (d.retention.actual == null ? unk() : fmtDays(d.retention.actual) || 'source lifetime'); }).join('<br>') : unk()], ['Deletion', ds.length ? ds.map(function (d) { return esc(d.name) + ': ' + (d.deletionVerified ? '<span class="ok">verified</span>' : '<span class="bad">' + esc(d.deletion) + '</span>'); }).join('<br>') : unk()]]) + '</div>' +
      '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:8px">LINDDUN threats & harms</h2><div class="chips" style="margin-bottom:8px">' + ['Linking', 'Identifying', 'Non-repudiation', 'Detecting', 'Data disclosure', 'Unawareness', 'Non-compliance'].map(function (l) { return '<span class="tag' + (lind.indexOf(l) >= 0 ? ' sev-HIGH' : '') + '">' + l + '</span>'; }).join('') + '</div><div class="small muted">Harms: ' + (harms.length ? esc(harms.join(' · ')) : noLineage || !ds.length ? unk('cannot be assessed without lineage') : 'none identified') + '</div></div>' +
      '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:8px">Required controls (from tier defaults)</h2>' + (tc.length ? '<ul class="checks">' + tc.map(function (x) { return '<li><span class="ic bad">✗</span><span>' + x + '</span></li>'; }).join('') + '</ul>' : ds.length ? '<p class="ok small">All tier defaults met.</p>' : unk('Tier defaults cannot be checked — no datasets')) + '</div>' +
      '<div class="card"><h2 class="sec" style="margin-bottom:8px">Open questions for the owner</h2>' + (openQ.length || !ds.length ? '<ol style="margin:0;padding-left:18px;font-size:13px">' + (ds.length ? '' : '<li style="margin:3px 0">' + unk('Which datasets, systems and flows does this feature use?') + ' Nothing is registered, so no answer on this page can be proven.</li>') + openQ.map(function (x) { return '<li style="margin:3px 0">' + esc(x) + '</li>'; }).join('') + '</ol>' : '<p class="small dim">None.</p>') + '</div>' +
    '</div></div>';
}
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

/* ════════════ CONSENT ════════════ */
var REVOKE_STEPS = [['Collection stops', 'cc1'], ['API reads stop', 'cc3'], ['Warehouse reads stop', 'cc5'], ['Scheduled jobs receive the update', 'cc7'], ['Cached consent expires', 'cc4'], ['Derived data handled', 'cc10'], ['ML features updated', 'cc14'], ['Vendors notified', 'cc11'], ['Audit evidence generated', null]];
function revStepsHTML() { return REVOKE_STEPS.map(function (st, i) { return '<li data-i="' + i + '"><span class="ic dim">·</span><span>' + esc(st[0]) + (st[1] ? ' <span class="small dim">— ' + esc(P.name(st[1])) + '</span>' : '') + '</span></li>'; }).join(''); }
V['privacy/consent'] = { title: 'Consent', render: function () {
  var cs = NS.consentConsumers, live = cs.filter(function (c) { return c.p50 != null; });
  var p50 = nearestRank(live.map(function (c) { return c.p50; }), 0.5), p95 = nearestRank(live.map(function (c) { return c.p95; }), 0.95), p99 = Math.max.apply(null, live.map(function (c) { return c.p99; }));
  var never = cs.filter(function (c) { return c.p50 == null; }), staleC = never.filter(function (c) { return c.stale; });
  var stale = staleC.reduce(function (s, c) { return s + c.stale; }, 0), staleMax = staleC.reduce(function (m, c) { return Math.max(m, c.stale); }, 0);
  var W = 760, rowH = 30, H = cs.length * rowH + 40, x0 = 230, xs = function (v) { return x0 + (Math.log10(Math.max(v, 0.05)) + 1.4) / (6.2 + 1.4) * (W - x0 - 60); };
  var s = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" style="min-width:560px" role="group" aria-label="Consent propagation latency per consumer">';
  [[0.1, '100 ms'], [1, '1 s'], [60, '1 min'], [3600, '1 h'], [86400, '1 d'], [604800, '7 d']].forEach(function (t) { var x = xs(t[0]); s += '<line x1="' + x + '" x2="' + x + '" y1="10" y2="' + (H - 24) + '" stroke="#e7e1d5"/><text x="' + x + '" y="' + (H - 8) + '" fill="#6b6457" font-size="12" text-anchor="middle">' + t[1] + '</text>'; });
  cs.forEach(function (c, i) {
    var y = 20 + i * rowH;
    s += '<g class="node" data-ent="' + c.id + '" tabindex="0" role="button" aria-label="' + esc(c.name) + '"><text x="' + (x0 - 10) + '" y="' + (y + 4) + '" fill="' + (c.p50 == null ? '#b3400b' : '#3a4250') + '" font-size="13" text-anchor="end">' + esc(c.name) + '</text>';
    if (c.p50 == null) s += '<line x1="' + x0 + '" x2="' + (W - 4) + '" y1="' + y + '" y2="' + y + '" stroke="#c0470f" stroke-dasharray="3 4" stroke-opacity=".6"/><text x="' + (W - 4) + '" y="' + (y - 5) + '" fill="#b3400b" font-size="11.5" text-anchor="end">never · ' + esc(c.mode) + '</text>';
    else {
      s += '<line x1="' + xs(c.p50) + '" x2="' + xs(c.p99) + '" y1="' + y + '" y2="' + y + '" stroke="#0b7d60" stroke-opacity=".5" stroke-width="2"/><circle cx="' + xs(c.p95) + '" cy="' + y + '" r="3" fill="none" stroke="#0b7d60"/><circle cx="' + xs(c.p50) + '" cy="' + y + '" r="5" fill="#0b7d60"/>';
      var lx = xs(c.p99), w = c.mode.length * 11.5 * 0.6;
      s += lx + 9 + w <= W - 2 ? '<text x="' + (lx + 9).toFixed(1) + '" y="' + (y + 4) + '" fill="#6b6457" font-size="11.5">' + esc(c.mode) + '</text>' : '<text x="' + (xs(c.p50) - 9).toFixed(1) + '" y="' + (y + 4) + '" fill="#6b6457" font-size="11.5" text-anchor="end">' + esc(c.mode) + '</text>';
    }
    s += '</g>';
  });
  s += '</svg>';
  return P.pageHead('Privacy', 'Consent command center', 'Consent is <b>state</b>, not a checkbox: who, purpose, scope, source, timestamp, expiry, version, jurisdiction. Every state change must reach every copy — including the ones in flight.') +
    '<div class="grid g-main" style="margin-bottom:14px"><div class="card"><div class="card-h"><h2 class="sec">Consent propagation latency</h2><span class="sub">dot P50 · ring P95 · bar to P99 · log scale</span></div>' + scrollFig('Consent propagation latency chart', s) + '</div>' +
    '<div class="card"><div class="stat-row" style="margin-bottom:12px"><div class="stat"><div class="sv">' + P.fmtSecs(p50) + '</div><div class="sl">P50</div></div><div class="stat"><div class="sv">' + P.fmtSecs(p95) + '</div><div class="sl">P95</div></div><div class="stat"><div class="sv">' + P.fmtSecs(p99) + '</div><div class="sl">P99</div></div><div class="stat"><div class="sv bad">' + never.length + '</div><div class="sl">never receive it</div></div></div>' +
    '<p class="small dim mono" style="margin:0 0 12px">Nearest-rank percentiles, so each figure is a value one consumer actually has: P50 = median of consumer P50s; P95 = 95th percentile of consumer P95s; P99 = worst consumer P99 — over the ' + live.length + ' consumers that propagate at all.</p>' +
    '<div class="callout warn"><b>Up to ' + fmtN(stale) + ' people</b> are being processed on stale consent by ' + pl(staleC.length, 'consumer') + '. The consumers overlap — one person can sit in several — so the true number is between ' + fmtN(staleMax) + ' (the largest single consumer) and ' + fmtN(stale) + ' (their sum).<ul class="pv-list">' + staleC.map(function (c) { return '<li>' + chip(c.id) + ' <b>' + fmtN(c.stale) + '</b> <span class="small dim">' + esc(c.mode) + '</span></li>'; }).join('') + '</ul></div>' + stateMachine() + '</div></div>' +
    '<div class="card"><div class="card-h"><h2 class="sec">Simulate a revocation</h2><button class="btn danger" id="revoke">Revoke advertising consent for one person</button></div><ul class="checks" id="revSteps">' + revStepsHTML() + '</ul></div>';
}, mount: function (root) {
  root.querySelector('#revoke').addEventListener('click', function () {
    var btn = this, list = root.querySelector('#revSteps'); btn.disabled = true;
    list.innerHTML = revStepsHTML();
    var lis = list.querySelectorAll('li'), failed = 0, reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lis.forEach(function (li, i) {
      setTimeout(function () {
        var id = REVOKE_STEPS[i][1], c = id ? P.get(id).obj : null, ic = li.querySelector('.ic'), cls, mark, note;
        if (c) {
          var ok = c.p50 != null, slow = ok && c.p50 > 3600;
          if (!ok) failed++;
          cls = ok ? (slow ? 'warn' : 'ok') : 'bad'; mark = ok ? (slow ? '~' : '✓') : '✗'; note = ok ? 'after ' + P.fmtSecs(c.p50) + ' (P50)' : 'NEVER — ' + esc(c.mode);
        } else if (failed) { cls = 'bad'; mark = '!'; note = 'receipt written, but it records ' + pl(failed, 'step') + ' that never propagated — the revocation is not complete'; }
        else { cls = 'ok'; mark = '✓'; note = 'receipt written: every step confirmed'; }
        ic.className = 'ic ' + cls; ic.textContent = mark;
        li.lastChild.insertAdjacentHTML('beforeend', ' <span class="small ' + cls + '">' + note + '</span>');
        if (i === lis.length - 1) btn.disabled = false;
      }, reduce ? 0 : 380 * (i + 1));
    });
  });
} };
function stateMachine() {
  return '<svg viewBox="0 0 420 182" width="100%" style="margin-top:12px" role="img" aria-label="Consent state machine: unknown, granted, revoked, expired"><defs><marker id="smA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6b6457"/></marker></defs>' +
    [['UNKNOWN', 20, 70, '#6346c9'], ['GRANTED', 160, 20, '#0b7d60'], ['REVOKED', 300, 70, '#b3400b'], ['EXPIRED', 160, 120, '#7a5200']].map(function (n) { return '<rect x="' + n[1] + '" y="' + n[2] + '" width="100" height="30" rx="15" fill="#fffdf9" stroke="' + n[3] + '"' + (n[0] === 'UNKNOWN' ? ' stroke-dasharray="4 3"' : '') + '/><text x="' + (n[1] + 50) + '" y="' + (n[2] + 19) + '" fill="' + n[3] + '" font-size="11.5" font-weight="700" text-anchor="middle" font-family="JetBrains Mono">' + n[0] + '</text>'; }).join('') +
    '<path d="M120,78 L160,42" stroke="#6b6457" marker-end="url(#smA)"/><text x="100" y="52" fill="#5b5448" font-size="10.5">opt in</text>' +
    '<path d="M260,40 L300,72" stroke="#6b6457" marker-end="url(#smA)"/><text x="284" y="48" fill="#5b5448" font-size="10.5">revoke</text>' +
    '<path d="M300,94 C260,110 250,40 262,36" fill="none" stroke="#6b6457" stroke-dasharray="3 3" marker-end="url(#smA)"/><text x="304" y="116" fill="#5b5448" font-size="10.5">re-consent</text>' +
    '<path d="M210,50 L210,118" stroke="#6b6457" marker-end="url(#smA)"/><text x="204" y="90" fill="#5b5448" font-size="10.5" text-anchor="end">scope ends</text>' +
    '<path d="M160,135 C110,150 90,110 170,52" fill="none" stroke="#6b6457" stroke-dasharray="3 3" marker-end="url(#smA)"/><text x="36" y="152" fill="#5b5448" font-size="10.5">re-prompt</text>' +
    '<text x="20" y="176" fill="#5b5448" font-size="10.5">default: no processing</text></svg>';
}

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

/* ════════════ RETENTION OBSERVATORY ════════════ */
function classes() { var out = {}; uniq(Object.keys(NS.datasetClass).map(function (k) { return NS.datasetClass[k]; })).forEach(function (c) { out[c] = NS.datasets.filter(function (d) { return d.class === c; }).map(function (d) { return d.id; }); }); var none = NS.datasets.filter(function (d) { return !d.class; }).map(function (d) { return d.id; }); if (none.length) out.unclassified = none; return out; }
V['privacy/retention'] = { title: 'Retention', render: function () {
  var CL = classes(), W = 780, x0 = 210, FS = 13, xs = function (d) { return x0 + Math.log10(Math.max(d, 1)) / Math.log10(4000) * (W - x0 - 30); };
  var rows = []; Object.keys(CL).forEach(function (c) { rows.push(['h', c]); CL[c].forEach(function (id) { rows.push(['d', id]); }); });
  var H = rows.length * 24 + 40, y = 16;
  var s = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" style="min-width:560px" role="group" aria-label="Required versus actual retention per dataset, log scale">';
  [[1, '1 d'], [7, '1 wk'], [30, '30 d'], [90, '90 d'], [365, '1 yr'], [1095, '3 yr'], [3650, '10 yr']].forEach(function (t) { var x = xs(t[0]); s += '<line x1="' + x + '" x2="' + x + '" y1="10" y2="' + (H - 22) + '" stroke="#e7e1d5"/><text x="' + x + '" y="' + (H - 6) + '" fill="#6b6457" font-size="' + FS + '" text-anchor="middle">' + t[1] + '</text>'; });
  rows.forEach(function (r) {
    if (r[0] === 'h') { s += '<text x="8" y="' + (y + 13) + '" fill="#5b5448" font-size="11" font-family="JetBrains Mono" letter-spacing="1">' + esc(r[1].toUpperCase()) + '</text>'; y += 24; return; }
    var d = P.get(r[1]).obj, rt = d.retention, cy = y + 9;
    s += '<g class="node" data-ent="' + d.id + '" tabindex="0" role="button" aria-label="' + esc(d.name) + '"><text x="' + (x0 - 10) + '" y="' + (cy + 4) + '" fill="#3a4250" font-size="' + FS + '" text-anchor="end">' + esc(d.name.length > 27 ? d.name.slice(0, 26) + '…' : d.name) + '</text>';
    if (rt.actual == null) s += '<text x="' + x0 + '" y="' + (cy + 4) + '" fill="#6346c9" font-size="11">UNKNOWN RETENTION</text><rect x="' + (x0 + 128) + '" y="' + (cy - 5) + '" width="' + (W - x0 - 158) + '" height="10" rx="5" fill="none" stroke="#6346c9" stroke-dasharray="4 3"/>';
    else if (rt.actual === 0) s += '<text x="' + x0 + '" y="' + (cy + 4) + '" fill="#5b5448" font-size="11">' + esc(rt.note || 'source lifetime') + '</text>';
    else {
      var hasReq = rt.required != null && rt.required > 0, over = hasReq && rt.actual > rt.required, col = rt.required == null ? '#6346c9' : over ? '#c0470f' : '#0b7d60';
      if (hasReq) s += '<line x1="' + xs(rt.required) + '" x2="' + xs(rt.actual) + '" y1="' + cy + '" y2="' + cy + '" stroke="' + (over ? '#c0470f' : '#0b7d60') + '" stroke-width="3" stroke-opacity=".5"/><line x1="' + xs(rt.required) + '" x2="' + xs(rt.required) + '" y1="' + (cy - 7) + '" y2="' + (cy + 7) + '" stroke="#0b7d60" stroke-width="2"/>';
      s += '<circle cx="' + xs(rt.actual) + '" cy="' + cy + '" r="5" fill="' + col + '"' + (rt.required == null ? ' fill-opacity=".25" stroke="#6346c9" stroke-dasharray="2 2"' : rt.ttl ? '' : ' stroke="#1d2430" stroke-dasharray="2 2"') + '/>';
      if (rt.required == null) s += svgLabel(xs(rt.actual), cy + 4, 'no requirement', W, '#6346c9', 11);
      else if (over) s += svgLabel(xs(rt.actual), cy + 4, Math.round(rt.actual / rt.required) + '× need', W, '#b3400b', 11);
    }
    s += '</g>'; y += 24;
  });
  s += '</svg>';
  var det = [];
  NS.datasets.forEach(function (d) {
    var r = d.retention, known = r.actual != null, req = r.required != null;
    if (!known || (!req && r.note == null)) det.push(['UNKNOWN RETENTION', d.id]);
    if (!r.ttl && r.note == null && known) det.push(['NO TTL', d.id]);
    if (known && req && r.required > 0 && r.actual > r.required) det.push(['TTL DRIFT', d.id]);
    if ((d.class === 'raw' || d.class === 'events') && known && req && r.actual > 180 && r.actual > r.required) det.push(['RAW DATA TOO OLD', d.id]);
    if (!d.owner) det.push(['ORPHANED DATA', d.id]);
    if (d.kind === 'log' && known && r.actual > 30 && d.fields.some(function (f) { return f[1] >= 2 && f[2] !== 'attr' || /url|prompt/.test(f[0]); })) det.push(['PII IN LONG-LIVED LOGS', d.id]);
  });
  NS.vendors.forEach(function (v) { if (v.retention.contract != null && v.retention.actual != null && v.retention.actual > v.retention.contract) det.push(['VENDOR RETENTION MISMATCH', v.id]); });
  /* backups: expiry must be enforced, within its requirement, and deletions must be re-applied (verified) */
  var backups = NS.datasets.filter(function (d) { return d.class === 'backups'; });
  var bad = backups.filter(function (d) { var r = d.retention; return !r.ttl || r.actual == null || r.required == null || r.actual > r.required || !d.deletionVerified; });
  bad.forEach(function (d) { det.push(['BACKUP VIOLATIONS', d.id]); });
  if (!bad.length) det.push(['BACKUP VIOLATIONS', null]);
  var backupOk = backups.length ? 'none — ' + backups.map(function (d) { return d.name + ' expires at ' + fmtDays(d.retention.actual) + ' (TTL enforced, requirement ' + fmtDays(d.retention.required) + '); deletion verified: ' + d.deletion; }).join('; ') : null;
  var groups = {}; det.forEach(function (x) { (groups[x[0]] = groups[x[0]] || []).push(x[1]); });
  return P.pageHead('Privacy', 'Retention observatory', 'Retention is a risk multiplier: every extra day is another day for breach, subpoena, misuse, inference and scope creep. Raw, derived, aggregate, logs, backups, events and ML data are tracked separately.') +
    '<div class="q-line"><strong>After the decision is made, do we still need the raw event?</strong> Raw events: keep days, not years. Derived features: keep what the decision needs. Aggregates: keep, with identifiers expired.</div>' +
    '<div class="grid g-main"><div class="card"><div class="card-h"><h2 class="sec">Required vs actual</h2><span class="sub">teal tick = required · dot = oldest record · dashed dot = no TTL · <span class="unknown">violet = no requirement or unknown</span></span></div>' + scrollFig('Required versus actual retention chart', s) + '</div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:10px">Detections</h2>' + Object.keys(groups).map(function (g) { var ids = groups[g].filter(Boolean); return '<div style="margin-bottom:10px"><div class="card-h" style="margin-bottom:4px"><span class="mono small ' + (/UNKNOWN|ORPHAN/.test(g) ? 'unknown' : ids.length ? 'bad' : 'ok') + '" style="border:0">' + g + '</span><span class="mono small">' + ids.length + '</span></div>' + (ids.length ? P.chips(ids) : g === 'BACKUP VIOLATIONS' ? (backupOk ? '<span class="small ok">' + esc(backupOk) + '</span>' : unk('no backup dataset registered')) : '<span class="small ok">none</span>') + '</div>'; }).join('') + '</div></div>';
} };

/* ════════════ FORGET ME ════════════ */
var FM_COL = { verified: '#0b7d60', waiting: '#946300', failed: '#c0470f', unknown: '#6346c9' };
V['privacy/deletion'] = { title: 'Forget Me', render: function () {
  var T = NS.deletionTargets, n = T.length, v = T.filter(function (t) { return t[3] === 'verified'; }).length, sysN = uniq(T.map(function (t) { return t[0]; })).length;
  /* copies the orchestrator does not know about: failed assumption tests that say so */
  var extra = NS.assumptionTests.filter(function (t) { return t.result === 'fail' && /not in (the )?deletion orchestrator/i.test(t.where); });
  var legend = '<div class="legend" style="justify-content:center;margin-top:10px"><span><i style="background:' + FM_COL.verified + '"></i>verified</span><span><i style="background:' + FM_COL.waiting + '"></i>waiting (vendor)</span><span><i style="background:' + FM_COL.failed + '"></i>failed</span><span><i class="dash"></i>unknown</span><span><i style="background:#d3cbbb"></i>not started</span></div>';
  return P.pageHead('Privacy · the real burn button', 'Forget me', 'Design every system as if “Forget me” had to work. One request fans out to every place the data was ever copied — primary, replicas, caches, streams, warehouse, logs, indexes, backups, feature stores, models, CRM, vendors. Miss one and the promise breaks.') +
    '<div class="grid g-main"><div class="card"><div class="canvas" id="fmCanvas" tabindex="0" role="region" aria-label="Deletion fan-out diagram" style="background:var(--bg2);border:0"></div>' + legend + '</div>' +
    '<div class="card"><div class="forget"><button class="forget-btn" id="fmBtn">Forget me</button><div class="small muted">Simulates one person\'s deletion across Northstar</div></div>' +
    '<div class="stat-row" style="justify-content:center;margin:16px 0" id="fmStats"><div class="stat"><div class="sv">' + n + '</div><div class="sl">locations (' + pl(sysN, 'system') + ')</div></div><div class="stat"><div class="sv ok">' + P.pct(v, n) + '%</div><div class="sl">verified deletion coverage</div></div></div>' +
    '<div id="fmLog" class="small"></div>' +
    extra.map(function (t) { return '<div class="callout unk" style="margin-top:12px"><b>+1 copy the orchestrator does not know about:</b> ' + esc(t.where) + ' ' + chip(t.ent) + ' <span class="small dim">(assumption test “' + esc(t.k) + '”: ' + esc(t.result) + ')</span>. If deletion cannot be proven, the uncertainty is a finding.</div>'; }).join('') +
    '<div class="small muted" style="margin-top:12px">Mechanisms in use: tombstones · hard delete · soft-delete expiry · crypto-shredding · cache invalidation · vendor deletion API · attestation · retries · verification scan (canary IDs re-queried at T+72h).</div></div></div>';
}, mount: function (root) {
  var T = NS.deletionTargets, el = root.querySelector('#fmCanvas'), W = 640, H = 560, cx = W / 2, cy = H / 2, R = 225, col = FM_COL;
  function draw(state) {
    var s = '<svg viewBox="-80 0 ' + (W + 160) + ' ' + H + '" width="100%" style="min-width:560px;max-width:' + (W + 160) + 'px;display:block;margin:auto" role="group" aria-label="Deletion fan-out to ' + T.length + ' locations">';
    T.forEach(function (t, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / T.length, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a), st = state[i], c = st && col[st] ? col[st] : st === 'pending' ? '#9aa1ac' : '#d3cbbb';
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + c + '" stroke-opacity="' + (st ? 0.55 : 0.25) + '"' + (st === 'unknown' ? ' stroke-dasharray="4 3"' : '') + (st === 'pending' ? ' class="flowdash" stroke-dasharray="4 4"' : '') + '/>';
      var anchor = Math.cos(a) > 0.15 ? 'start' : Math.cos(a) < -0.15 ? 'end' : 'middle', dx = anchor === 'start' ? 11 : anchor === 'end' ? -11 : 0, dy = anchor === 'middle' ? (Math.sin(a) > 0 ? 22 : -13) : 4;
      s += '<g class="node" data-ent="' + t[0] + '" tabindex="0" role="button" aria-label="' + esc(t[1] + ': ' + (st && st !== 'pending' ? st : 'not started')) + '"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7" fill="' + (st && st !== 'pending' ? c : '#f6f3ec') + '" stroke="' + c + '"' + (st === 'unknown' ? ' fill-opacity="0" stroke-dasharray="2 2"' : '') + '/><text x="' + (x + dx).toFixed(1) + '" y="' + (y + dy).toFixed(1) + '" fill="#3a4250" font-size="12" text-anchor="' + anchor + '">' + esc(t[1]) + '</text></g>';
    });
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="56" fill="#f6f3ec" stroke="#b9b1a0"/><text x="' + cx + '" y="' + (cy - 4) + '" fill="#1d2430" font-size="12" font-weight="700" text-anchor="middle">DELETION</text><text x="' + cx + '" y="' + (cy + 12) + '" fill="#1d2430" font-size="12" font-weight="700" text-anchor="middle">ORCHESTRATOR</text>';
    el.innerHTML = s + '</svg>';
  }
  var init = T.map(function () { return null; }); draw(init);
  root.querySelector('#fmBtn').addEventListener('click', function () {
    var btn = this; btn.disabled = true;
    var state = T.map(function () { return 'pending'; }); draw(state);
    var log = root.querySelector('#fmLog'); log.innerHTML = '<div class="mono dim">DELETE REQUEST → DELETION ORCHESTRATOR · ' + T.length + ' locations</div>';
    var order = T.map(function (t, i) { return i; }).sort(function (a, b) { var r = { verified: 0, waiting: 1, failed: 2, unknown: 3 }; return r[T[a][3]] - r[T[b][3]] || a - b; });
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    order.forEach(function (i, k) {
      setTimeout(function () {
        state[i] = T[i][3]; draw(state);
        if (T[i][3] !== 'verified') log.insertAdjacentHTML('beforeend', '<div><span class="' + (T[i][3] === 'waiting' ? 'warn' : T[i][3] === 'unknown' ? 'unknown' : 'bad') + '" style="border:0">' + T[i][3].toUpperCase() + '</span> ' + esc(T[i][1]) + ' — ' + esc(T[i][2]) + '</div>');
        if (k === order.length - 1) {
          var c = {}; T.forEach(function (t) { c[t[3]] = (c[t[3]] || 0) + 1; });
          root.querySelector('#fmStats').innerHTML = [['verified', 'ok'], ['waiting', 'warn'], ['failed', 'bad'], ['unknown', 'unknown']].map(function (x) { return '<div class="stat"><div class="sv ' + x[1] + '" style="border:0">' + (c[x[0]] || 0) + '</div><div class="sl">' + x[0] + (x[0] === 'waiting' ? ' (vendor)' : '') + '</div></div>'; }).join('') + '<div class="stat"><div class="sv">' + P.pct(c.verified || 0, T.length) + '%</div><div class="sl">verified coverage</div></div>';
          btn.disabled = false;
        }
      }, reduce ? 0 : 140 * (k + 1));
    });
  });
} };

/* ════════════ USER RIGHTS ════════════ */
function deadlineFor(x) { var rs = NS.rightsDeadlines; for (var i = 0; i < rs.length; i++) if (rs[i].region === x.region && (rs[i].rights === '*' || rs[i].rights.indexOf(x.type) >= 0)) return rs[i]; return null; }
function rightsRows() {
  return NS.rightsRequests.map(function (x) {
    var dl = deadlineFor(x), elapsed = x.status === 'open' ? P.daysSince(x.received) : x.took;
    var late = dl != null && x.status !== 'refused' && elapsed > dl.days;
    return { x: x, dl: dl, elapsed: elapsed, late: late };
  });
}
V['privacy/rights'] = { title: 'User Rights', render: function () {
  var R = rightsRows(), open = R.filter(function (r) { return r.x.status === 'open'; }), done = R.filter(function (r) { return r.x.status === 'complete'; }), refused = R.filter(function (r) { return r.x.status === 'refused'; });
  var med = nearestRank(done.map(function (r) { return r.x.took; }), 0.5), p95 = nearestRank(done.map(function (r) { return r.x.took; }), 0.95);
  var late = R.filter(function (r) { return r.late; }), lateDone = done.filter(function (r) { return r.late; }), noDl = R.filter(function (r) { return !r.dl; });
  var unver = done.filter(function (r) { return !r.x.verified; });
  var delay = {}, delayN = 0; done.forEach(function (r) { if (r.x.delay) { delay[r.x.delay] = (delay[r.x.delay] || 0) + 1; delayN++; } });
  var dk = Object.keys(delay).sort(function (a, b) { return delay[b] - delay[a] || (a < b ? -1 : 1); }), maxD = dk.length ? delay[dk[0]] : 1;
  var vendDelay = dk.filter(isVendor).reduce(function (s, k) { return s + delay[k]; }, 0);
  var BINS = 11, hist = []; for (var b = 0; b < BINS; b++) { var inBin = done.filter(function (r) { return Math.min(BINS - 1, Math.floor(r.x.took / 5)) === b; }); hist.push([inBin.filter(function (r) { return !r.late; }).length, inBin.filter(function (r) { return r.late; }).length]); }
  var hmax = Math.max.apply(null, hist.map(function (h) { return h[0] + h[1]; }).concat([1]));
  var lateDl = uniq(lateDone.map(function (r) { return r.dl.days; })).sort(function (a, b) { return a - b; });
  var sorted = R.slice().sort(function (a, b) { var k = function (r) { return r.x.status === 'open' ? (r.late ? 0 : 1) : r.late ? 2 : r.x.status === 'refused' ? 3 : 4; }; return k(a) - k(b) || (b.elapsed - a.elapsed); });
  var all = !!P.state.rightsAll, shown = all ? sorted : sorted.slice(0, 24);
  var stats = [
    ['Open requests', open.length, 'Requests with status open.'],
    ['Median completion', med == null ? unk() : med + ' d', 'Nearest-rank median of days to complete, over ' + done.length + ' completed requests.'],
    ['P95 completion', p95 == null ? unk() : p95 + ' d', 'Nearest-rank 95th percentile of the same.'],
    ['Deadline misses', late.length, 'Completed after, or still open past, that request’s own deadline (table below).', 'bad'],
    ['Completion not verified', unver.length, 'Completed requests with no verification scan proving the data is gone.', 'bad'],
    ['Refused — identity not verified', refused.length, 'Identity check failed, so the request was refused and closed; nothing was disclosed or deleted.']
  ];
  return P.pageHead('Privacy', 'User rights operations', 'Access · delete · correct · port · opt out · object · limit sensitive use. Every right is a system requirement in disguise; the hard prerequisite behind all of them is lineage — you cannot delete what you cannot find.') +
    '<div class="card" style="margin-bottom:14px">' + statRow(stats) + (noDl.length ? '<p class="small" style="margin:8px 0 0">' + unk(pl(noDl.length, 'request') + ' with no deadline rule') + '</p>' : '') + '</div>' +
    '<div class="grid g2" style="margin-bottom:14px"><div class="card"><h2 class="sec" style="margin-bottom:10px">Completion time (days)</h2><div class="hist" role="img" aria-label="Completion time histogram: ' + lateDone.length + ' of ' + done.length + ' completed requests were late">' + hist.map(function (h, i) { var t = h[0] + h[1]; return '<div class="hb" title="' + (i * 5) + (i === BINS - 1 ? '+' : '–' + (i * 5 + 4)) + ' d: ' + t + ' (' + h[1] + ' late)"><span class="hs"><span style="height:' + (h[1] / hmax * 100) + '%;background:var(--exp)"></span><span style="height:' + (h[0] / hmax * 100) + '%;background:var(--info)"></span></span><em>' + (i === BINS - 1 ? (i * 5) + '+' : i * 5) + '</em></div>'; }).join('') + '</div>' +
      '<p class="small dim">Coral: completed after that request’s own deadline' + (lateDl.length ? ' (' + lateDl.map(function (d) { return d + ' d'; }).join(', ') + ' in these cases)' : '') + '. ' + lateDone.length + ' of ' + done.length + ' completed requests were late.</p></div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:10px">Systems causing delay</h2>' + (dk.length ? '<div class="bars">' + dk.map(function (k) { return '<div class="br"><span>' + chip(k) + '</span><span class="track"><span class="fill" style="width:' + (delay[k] / maxD * 100) + '%;background:' + (isVendor(k) ? 'var(--exp)' : 'var(--med)') + '"></span></span><span class="mono small" style="text-align:right">' + delay[k] + '</span></div>'; }).join('') + '</div><p class="small dim">Rule: the system each completed request waited on longest. Vendors in coral. Largest single cause: ' + esc(P.name(dk[0])) + ' (' + delay[dk[0]] + ' of ' + delayN + '); vendors account for ' + vendDelay + ' of ' + delayN + '.</p>' : '<p class="small ok">No completed request recorded a delay.</p>') + '</div></div>' +
    '<div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:8px">Deadlines used (simplified — orientation, not legal advice)</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Region</th><th>Rights</th><th class="num">Deadline</th><th class="num">Extension</th><th>Identity check</th><th>Basis</th></tr></thead><tbody>' + NS.rightsDeadlines.map(function (d) { return '<tr><td class="mono small">' + esc(d.region) + '</td><td class="small">' + (d.rights === '*' ? 'all others' : esc(d.rights.join(', '))) + '</td><td class="num">' + d.days + ' d</td><td class="num">' + (d.ext ? '+' + d.ext + ' d' : '—') + '</td><td class="small">' + (d.verify ? 'required' : 'not required') + '</td><td class="small">' + esc(d.basis) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
    '<div class="card-h" style="margin-bottom:8px"><span class="small muted">Showing ' + shown.length + ' of ' + R.length + ' requests — open and overdue first.</span>' + (R.length > 24 ? '<button class="btn" id="rrAll" aria-expanded="' + all + '">' + (all ? 'Show fewer' : 'Show all ' + R.length) + '</button>' : '') + '</div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Request</th><th>Right</th><th>Region</th><th>Identity</th><th>Received</th><th class="num">Days</th><th class="num">Deadline</th><th>Status</th><th>Delayed by</th></tr></thead><tbody>' + shown.map(function (r) {
      var x = r.x, st = x.status === 'open' ? (r.late ? '<span class="bad">open · overdue</span>' : '<span class="dim">open</span>') : x.status === 'refused' ? '<span class="warn">refused · identity not verified</span>' : x.verified ? '<span class="ok">complete · verified</span>' : '<span class="warn">complete · not verified</span>';
      return '<tr><td class="mono small">' + x.id + '</td><td>' + esc(x.type) + '</td><td class="mono small">' + esc(x.region) + '</td><td class="small ' + (x.idv === 'failed' ? 'bad' : 'dim') + '">' + esc(x.idv) + '</td><td class="mono small">' + esc(x.received) + '</td><td class="num ' + (r.late ? 'bad' : '') + '">' + r.elapsed + ' d</td><td class="num">' + (r.dl ? r.dl.days + ' d' : unk()) + '</td><td>' + st + '</td><td>' + (x.delay ? chip(x.delay) : '<span class="dim">—</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<p class="small dim">“Days” is days open for open requests, and days to complete or refuse for closed ones. “Delayed by” is recorded only when a request completes.</p>' +
    '<style>.hist{display:grid;grid-template-columns:repeat(11,1fr);gap:4px;height:150px;align-items:end}.hb{display:flex;flex-direction:column;justify-content:flex-end;height:100%;text-align:center}.hs{display:flex;flex-direction:column;justify-content:flex-end;height:100%}.hs span{display:block}.hs span:first-child{border-radius:4px 4px 0 0}.hb em{font:10px var(--mono);color:var(--dim);font-style:normal;margin-top:4px}</style>';
}, mount: function (root) { var b = root.querySelector('#rrAll'); if (b) b.addEventListener('click', function () { P.state.rightsAll = !P.state.rightsAll; P._keepScroll = true; P.render(); }); } };

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
