/* Views: Overview + Explore. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk;
var V = P.views;

/* ════════════ OVERVIEW — WHERE SHOULD I WORRY? ════════════ */
P.fullOverview = { title: 'Command Center', render: function () {
  var open = P.openFindings();
  var rOf = function (f) { var m = 0; NS.risks.forEach(function (r) { if (r.findings.indexOf(f.id) >= 0) m = Math.max(m, P.riskCalc(r).residual); }); return m; };
  var top = open.slice().sort(function (a, b) { var s = { HIGH: 3, MEDIUM: 2, LOW: 1 }; return (s[b.sev] - s[a.sev]) || (rOf(b) - rOf(a)) || (b.people - a.people); });
  var hiOpen = open.filter(function (f) { return f.sev === 'HIGH'; });
  var beyond = hiOpen.filter(function (f) { return /PURPOSE|LINKAB|EGRESS|TRACKING|SUBPROCESSOR|INFERENCE/.test(f.kind); }).length;
  var risks = P.risksSorted().filter(function (r) { return P.riskCalc(r).rating === 'HIGH'; });
  var high = P.metric('highfind').items().length;
  var worry = top.slice(0, 4).map(function (f, i) {
    return '<div data-ent="' + f.id + '" role="button" tabindex="0"><span class="n">' + (i + 1) + '</span><div><div class="t">' + esc(f.title) + '</div><div class="w">' + esc(f.human) + '</div></div><div style="text-align:right">' + P.sev(f.sev) + '<div class="small dim mono" style="margin-top:4px">' + fmtN(f.people) + '</div></div></div>';
  }).join('');
  var pd = P.personalDatasets(), sixAll = pd.map(P.six);
  var north = P.SIX.map(function (k, i) {
    var y = sixAll.filter(function (s) { return s[k] === 'y'; }).length, n = sixAll.filter(function (s) { return s[k] === 'n'; }).length, u = sixAll.length - y - n;
    return '<button data-act="sixList" data-k="' + k + '"><div class="qn">' + (i + 1) + ' · ' + k + '</div><div class="qt">' + esc(P.SIX_Q[k]) + '</div><div class="big">' + P.pct(y, pd.length) + '<span class="small dim">% answered</span></div><div class="bar"><i style="width:' + P.pct(y, pd.length) + '%;background:var(--ctl)"></i><i style="width:' + P.pct(n, pd.length) + '%;background:var(--exp)"></i><i style="width:' + P.pct(u, pd.length) + '%;background:repeating-linear-gradient(90deg,var(--unk) 0 3px,transparent 3px 5px)"></i></div><div class="fig"><span class="ok">' + y + ' ✓</span><span class="bad">' + n + ' ✗</span><span class="unknown" style="border:0">' + u + ' ?</span></div></button>';
  }).join('');
  var denom = { personal: NS.datasets.length, sensitive: NS.datasets.length, nottl: NS.datasets.length, retviol: NS.datasets.length, unmapped: NS.flows.length, paper: NS.controls.length, runtime: NS.controls.length, delfail: NS.deletionTargets.length, aipersonal: NS.models.length, aiprov: NS.models.length, sdks: NS.trackers.length, consentfail: NS.consentConsumers.length, hivendor: NS.vendors.length };
  var tiles = P.METRICS.filter(function (m) { return !m.hidden; }).map(function (m) {
    var n = m.items().length;
    return '<button class="tile ' + (m.tone || '') + '" data-metric="' + m.id + '" title="' + esc(m.rule) + '"><span class="v">' + n + '</span><span class="l">' + esc(m.label) + '</span><span class="d">' + (denom[m.id] ? 'of ' + denom[m.id] + ' · ' : '') + 'why? →</span></button>';
  }).join('');
  return '<section class="worry">' +
      '<div class="worry-hero"><p class="eyebrow">Northstar · ' + esc(NS.TODAY) + ' · ' + fmtN(NS.org.people) + ' people</p><h1>Where should I worry?</h1>' +
      '<p class="lede">' + high + ' high-risk findings are open. ' + beyond + ' of them share one pattern: <b>data travelling beyond the context it was collected for</b> — to another purpose, another identity, or another company. ' + risks.length + ' assets carry HIGH residual risk, and ' + P.metric('unmapped').items().length + ' flows exist that nobody has described.</p>' +
      '<div class="worry-list">' + worry + '</div>' +
      '<div class="btn-row" style="margin-top:14px"><button class="btn primary" data-act="tour">▶ Follow an investigation: HIGH RISK → root cause</button><a class="btn" href="#/explore/person">What could we know about one person?</a></div></div>' +
      '<div class="card"><div class="card-h"><h2 class="sec">The north star — can we answer six questions?</h2><span class="sub">across ' + pd.length + ' personal datasets</span></div>' +
      '<p class="small muted" style="margin:-4px 0 12px">For every piece of personal data. If we cannot answer one, the uncertainty itself is a finding.</p><div class="north">' + north + '</div></div>' +
    '</section>' +
    '<div class="tiles" role="group" aria-label="Live indicators — every number opens its evidence">' + tiles + '</div>' +
    '<section class="grid g-main" style="margin-bottom:14px">' +
      '<div class="card"><div class="card-h"><h2 class="sec">Worry map — where in the lifecycle, which business</h2><span class="sub">open findings weighted HIGH 3 · MED 2 · LOW 1</span></div>' + worryMap(open) + '</div>' +
      '<div class="card"><div class="card-h"><h2 class="sec" id="queueH">' + queueTitle() + '</h2><span class="sub">lens: ' + esc(P.state.role) + '</span></div>' + queue() + '</div>' +
    '</section>' +
    '<section class="grid g-main">' +
      '<div class="card"><div class="card-h"><h2 class="sec">Risk radar</h2><a class="small" href="#/privacy/risks">explainable model →</a></div>' + radarMini() + '</div>' +
      '<div class="card"><div class="card-h"><h2 class="sec">Privacy drift — live</h2><a class="small" href="#/assurance/drift">all changes →</a></div><div class="feed" id="liveFeed">' + NS.drift.slice(0, 7).map(feedItem).join('') + '</div></div>' +
    '</section>';
}, mount: function () {
  var lis = document.querySelectorAll('#liveFeed > div'); lis.forEach(function (li, i) { li.style.animationDelay = (i * 90) + 'ms'; li.classList.add('new'); });
} };
function feedItem(d) { return '<div data-ent="' + esc(d.entities[0]) + '" role="button" tabindex="0"><span class="ft">' + esc(d.t.slice(5, 10)) + '<br>' + esc(d.t.slice(11)) + '</span><div><div class="fk">' + esc(d.type) + ' ' + (d.sev === 'GOOD' ? '<span class="ok">▲</span>' : d.sev === 'HIGH' ? '<span class="bad">●</span>' : '') + '</div><div class="fx">' + esc(d.text) + '</div></div></div>'; }
P.feedItem = feedItem;
function worryMap(open) {
  var rows = NS.bus.map(function (b) { return b.id; }).concat(['__none']);
  var W = { HIGH: 3, MEDIUM: 2, LOW: 1 }, cell = {}, max = 1;
  open.forEach(function (f) { var b = P.buOf(f.id) || '__none', s = P.stageOf(f), k = b + '|' + s; cell[k] = (cell[k] || 0) + W[f.sev]; max = Math.max(max, cell[k]); });
  var h = '<div class="heat" style="grid-template-columns:minmax(90px,140px) repeat(6,minmax(0,1fr))"><span></span>' + P.STAGES.map(function (s) { return '<span class="hh">' + s + '</span>'; }).join('');
  rows.forEach(function (b) {
    h += '<span class="hr">' + (b === '__none' ? '<span class="unknown">no owner</span>' : esc(P.name(b))) + '</span>';
    P.STAGES.forEach(function (s) {
      var v = cell[b + '|' + s] || 0, a = v / max;
      h += '<button class="hc" data-act="heatCell" data-b="' + b + '" data-s="' + s + '" style="background:' + (v ? 'rgba(192,71,15,' + (0.12 + a * 0.75).toFixed(2) + ')' : 'var(--panel)') + ';color:' + (a > 0.55 ? '#ffffff' : 'var(--muted)') + '" aria-label="' + esc(P.name(b)) + ' ' + s + ': ' + v + '">' + (v || '') + '</button>';
    });
  });
  return h + '</div><p class="small dim" style="margin:10px 0 0">Click a cell for the findings behind it. The DELETE column is where promises most often become unprovable.</p>';
}
P.acts.heatCell = function (el) {
  var b = el.getAttribute('data-b'), s = el.getAttribute('data-s');
  var list = P.openFindings().filter(function (f) { return (P.buOf(f.id) || '__none') === b && P.stageOf(f) === s; });
  P.openHTML('Findings', '<p class="pp-type">Worry map · ' + esc(s) + '</p><h2 class="pp-title">' + esc(b === '__none' ? 'No owner' : P.name(b)) + '</h2>' + P.passportHelpers.findingsList(list), s);
};
P.acts.sixList = function (el) {
  var k = el.getAttribute('data-k');
  var rows = P.personalDatasets().map(function (d) { return [d, P.six(d)]; }).filter(function (x) { return x[1][k] !== 'y'; });
  P.openHTML(k, '<p class="pp-type">North-star question</p><h2 class="pp-title">' + esc(P.SIX_Q[k]) + '</h2><div class="why flag"><div class="wl">' + rows.length + ' DATASETS CANNOT ANSWER IT</div><p>Each is a finding, whether the answer is “no” or “we don\'t know”.</p></div><div class="tbl-wrap"><table class="tbl"><tbody>' +
    rows.map(function (x) { var w = x[1].why.filter(function (y) { return y[0] === k; })[0]; return '<tr class="click" data-ent="' + x[0].id + '"><td><b>' + esc(x[0].name) + '</b><div class="small dim">' + P.tier(P.dsTier(x[0])) + ' ' + fmtN(x[0].people) + ' people</div></td><td>' + (x[1][k] === 'u' ? unk(w ? w[1] : 'UNKNOWN') : '<span class="bad">' + esc(w ? w[1] : 'no') + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>', 'North star');
};
function queueTitle() { return { reviewer: 'Reviewer — find exposure before launch', builder: 'Builder — controls to move up the ladder', auditor: 'Auditor — what actually happens in production' }[P.state.role]; }
function queue() {
  var r = P.state.role, items = [];
  if (r === 'reviewer') {
    NS.reviews.filter(function (x) { return x.blockers || x.drift || ['INTAKE', 'TRIAGE', 'DESIGN REVIEW'].indexOf(x.stage) >= 0; }).sort(function (a, b) { return (b.blockers - a.blockers) || ((b.risk === 'HIGH') - (a.risk === 'HIGH')); }).slice(0, 7).forEach(function (x) {
      items.push('<div role="button" tabindex="0" data-go="privacy/reviews/' + x.feature + '"><div><div class="fx"><b>' + esc(P.name(x.feature)) + '</b> <span class="mono small dim">' + x.id + '</span></div><div class="small muted">' + esc(x.stage) + ' · ' + x.age + ' d' + (x.blockers ? ' · <span class="bad">' + x.blockers + ' launch blocker</span>' : '') + (x.drift ? ' · <span class="warn">post-launch drift</span>' : '') + (!x.reviewer ? ' · <span class="unknown">no reviewer</span>' : '') + '</div></div>' + P.sev(x.risk) + '</div>');
    });
  } else if (r === 'builder') {
    NS.controls.filter(function (c) { return c.level <= 1 || c.health === 'failing'; }).sort(function (a, b) { return a.level - b.level; }).slice(0, 8).forEach(function (c) {
      items.push('<div role="button" tabindex="0" data-ent="' + c.id + '"><div><div class="fx"><b>' + esc(c.name) + '</b></div><div class="small muted">' + P.lvl(c.level) + ' → build L' + Math.min(5, Math.max(3, c.level + 1)) + ' ' + P.LEVELS[Math.min(5, Math.max(3, c.level + 1))] + '</div></div><span class="tag ' + (c.health === 'failing' ? 'sev-HIGH' : c.health === 'unknown' ? 'k-UNKNOWN' : '') + '">' + c.health + '</span></div>');
    });
  } else {
    NS.assumptionTests.filter(function (t) { return t.result !== 'pass'; }).forEach(function (t) { items.push('<div role="button" tabindex="0" data-ent="' + esc(t.ent) + '"><div><div class="fx"><b>' + esc(t.k) + '</b> <span class="small dim">' + esc(t.q) + '</span></div><div class="small muted">' + esc(t.where) + '</div></div><span class="tag ' + (t.result === 'fail' ? 'sev-HIGH' : 'k-UNKNOWN') + '">' + t.result + '</span></div>'); });
    NS.deletionTargets.filter(function (t) { return t[3] !== 'verified' && t[3] !== 'waiting'; }).forEach(function (t) { items.push('<div role="button" tabindex="0" data-ent="' + t[0] + '"><div><div class="fx"><b>Forget-Me: ' + esc(t[1]) + '</b></div><div class="small muted">' + esc(t[2]) + '</div></div><span class="tag ' + (t[3] === 'unknown' ? 'k-UNKNOWN' : 'sev-HIGH') + '">' + t[3] + '</span></div>'); });
  }
  return '<div class="feed queue">' + items.join('') + '</div>';
}
function radarMini() {
  var W = 560, H = 250, pad = 36, rs = NS.risks;
  var xs = function (p) { return pad + (Math.log10(Math.max(p, 1e4)) - 4) / (8.4 - 4) * (W - pad * 2); };
  var ys = function (r) { return H - pad - (r / 45) * (H - pad * 2); };
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="group" aria-label="Risks by people affected and residual risk">';
  [1e5, 1e6, 1e7, 1e8].forEach(function (v) { var x = xs(v); s += '<line x1="' + x + '" x2="' + x + '" y1="' + pad / 2 + '" y2="' + (H - pad) + '" stroke="#e7e1d5"/><text x="' + x + '" y="' + (H - pad + 16) + '" fill="#6b6457" font-size="10" text-anchor="middle">' + fmtN(v) + '</text>'; });
  [[26, 'HIGH'], [16, 'MED']].forEach(function (t) { var y = ys(t[0]); s += '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y + '" y2="' + y + '" stroke="' + (t[1] === 'HIGH' ? '#c0470f' : '#946300') + '" stroke-opacity=".35" stroke-dasharray="4 4"/><text x="' + (W - pad) + '" y="' + (y - 4) + '" fill="#6b6457" font-size="10" text-anchor="end">' + t[1] + ' ≥ ' + t[0] + '</text>'; });
  s += '<text x="' + pad + '" y="' + (H - 6) + '" fill="#6b6457" font-size="10">people affected (log) →</text><text x="10" y="' + (pad / 2 + 4) + '" fill="#6b6457" font-size="10">residual ↑</text>';
  rs.forEach(function (r) {
    var c = P.riskCalc(r), d = P.get(r.asset).obj, x = xs(d.people), y = ys(c.residual), rad = 6 + r.f.sens * 2.2;
    var col = c.rating === 'HIGH' ? '#c0470f' : c.rating === 'MEDIUM' ? '#946300' : '#0b7d60';
    s += '<g class="node" data-ent="' + r.id + '" tabindex="0" role="button" aria-label="' + esc(r.name) + ' residual ' + c.residual + '"><circle cx="' + x + '" cy="' + y + '" r="' + rad + '" fill="' + col + '" fill-opacity=".22" stroke="' + col + '" stroke-width="1.5"/><text x="' + (x + rad + 4) + '" y="' + (y + 4) + '" fill="#1d2430" font-size="11">' + esc(r.name) + '</text></g>';
  });
  return s + '</svg><p class="small dim" style="margin:6px 0 0">Bubble size = data sensitivity. The two lowest-risk assets hold the most sensitive data — Pulse cycle logs and Messenger metadata — because architecture, not policy, protects them.</p>';
}

/* ════════════ ORGANIZATION EXPLORER ════════════ */
V['explore/org'] = { title: 'Organization', render: function () {
  function ds(d) { return '<li><button class="tree-n" data-sel="' + d.id + '">' + P.tier(P.dsTier(d)) + ' <span class="mono">' + esc(d.name) + '</span> <span class="dim small">' + esc(d.kind) + '</span></button><ul>' + d.fields.map(function (f) { return '<li><span class="tree-f">' + P.tier(f[1]) + ' <span class="mono small">' + esc(f[0]) + '</span></span></li>'; }).join('') + '</ul></li>'; }
  function sys(s) {
    var kids = NS.systems.filter(function (x) { return x.parent === s.id; });
    var dss = NS.datasets.filter(function (d) { return d.system === s.id; });
    var mdl = NS.models.filter(function (m) { return m.featureStore === s.id || m.training.some(function (t) { return dss.some(function (d) { return d.id === t; }); }); });
    var vend = P.uniq(P.flowsFrom(s.id).filter(function (f) { var e = P.get(f.to); return e && (e.type === 'vendor'); }).map(function (f) { return f.to; }));
    return '<li><button class="tree-n" data-sel="' + s.id + '"><span class="kind">' + esc(s.kind) + '</span> ' + esc(s.name) + (s.team ? '' : ' <span class="unknown small">no owner</span>') + '</button><ul>' +
      kids.map(sys).join('') + dss.map(ds).join('') +
      mdl.map(function (m) { return '<li><button class="tree-n" data-sel="' + m.id + '"><span class="kind">model</span> ' + esc(m.name) + '</button></li>'; }).join('') +
      vend.map(function (v) { return '<li><button class="tree-n" data-sel="' + v + '"><span class="kind" style="color:var(--exp)">vendor</span> ' + esc(P.name(v)) + '</button></li>'; }).join('') + '</ul></li>';
  }
  var tree = '<ul class="tree"><li><span class="tree-root">Northstar</span><ul>' + NS.bus.map(function (b) {
    var ps = NS.products.filter(function (p) { return p.bu === b.id; });
    return '<li><details' + (b.id === 'bu_commerce' ? ' open' : '') + '><summary class=\"tree-n\" data-sel=\"' + b.id + '\"><b>' + esc(b.name) + '</b></summary><ul>' + ps.map(function (p) {
      var fs = NS.features.filter(function (f) { return f.product === p.id; });
      var loose = NS.systems.filter(function (s) { return s.product === p.id && !s.feature && !s.parent; });
      return '<li><details' + (p.id === 'p_checkout' ? ' open' : '') + '><summary class=\"tree-n\" data-sel=\"' + p.id + '\">' + esc(p.name) + '</summary><ul>' + fs.map(function (f) {
        var ss = NS.systems.filter(function (s) { return s.feature === f.id; });
        return '<li><details' + (f.id === 'f_fraud' || f.id === 'f_oneclick' ? ' open' : '') + '><summary class=\"tree-n\" data-sel=\"' + f.id + '\"><span class="kind">feature</span> ' + esc(f.name) + '</summary><ul>' + ss.map(sys).join('') + '</ul></details></li>';
      }).join('') + loose.map(sys).join('') + '</ul></details></li>';
    }).join('') + '</ul></details></li>';
  }).join('') + '<li><details><summary><span class="tree-root">Shared platform</span></summary><ul>' + NS.systems.filter(function (s) { return !s.product && !s.parent; }).map(sys).join('') + '</ul></details></li></ul></li></ul>';
  var sel = P.route.q.sel || 'd_fraudfeat';
  return P.pageHead('Explore', 'Organization', 'Organization → business unit → product → feature → service → store → dataset → field, with the models and vendors hanging off each. Select anything to read its Privacy Passport.') +
    '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.15fr)"><div class="card" style="max-height:78vh;overflow:auto">' + tree + '</div><div class="card" id="orgPass" style="max-height:78vh;overflow:auto"></div></div>' +
    '<style>.tree,.tree ul{list-style:none;margin:0;padding-left:14px}.tree>li{padding-left:0}.tree li{position:relative;margin:2px 0}.tree ul{border-left:1px solid var(--line);margin-left:6px}.tree summary{list-style:none;cursor:pointer;min-height:24px;display:flex;align-items:center;gap:4px}.tree summary::before{content:"▸";color:var(--dim);font-size:11px;width:10px}.tree details[open]>summary::before{content:"▾"}.tree summary::-webkit-details-marker{display:none}.tree-n{all:unset;cursor:pointer;min-height:24px;box-sizing:border-box;padding:3px 7px;border-radius:6px;font-size:13px;display:inline-flex;gap:6px;align-items:center}.tree-n:hover{background:var(--panel2)}.tree-n:focus-visible{outline:2px solid var(--info)}.tree-n.on{background:var(--panel3);box-shadow:inset 0 0 0 1px var(--line3)}.tree-n.on .dim{color:var(--muted)}.tree .kind{font:600 9.5px var(--mono);color:var(--dim);text-transform:uppercase;letter-spacing:.06em}.tree-root{font-weight:700;font-size:13px;color:var(--muted)}.tree-f{display:inline-flex;gap:6px;align-items:center;padding:1px 7px;color:var(--muted)}@media(max-width:1100px){#orgPass{max-height:none!important}}</style>' +
    '<script type="text/plain" id="orgSel">' + esc(sel) + '</script>';
}, mount: function (root) {
  var pane = root.querySelector('#orgPass');
  function show(id) {
    var e = P.get(id); if (!e) return;
    root.querySelectorAll('.tree-n.on').forEach(function (b) { b.classList.remove('on'); });
    var b = root.querySelector('.tree-n[data-sel="' + id + '"]'); if (b) b.classList.add('on');
    pane.innerHTML = (P.passports[e.type] || P.passports.generic)(e.obj, e);
    P.state.trail[P.state.trail.length - 1] !== id && P.state.trail.push(id);
  }
  root.querySelector('.tree').addEventListener('click', function (ev) { var b = ev.target.closest('.tree-n'); if (!b) return; var leaf = b.tagName !== 'SUMMARY'; if (leaf) ev.preventDefault(); show(b.getAttribute('data-sel')); if (leaf && window.innerWidth < 1100) pane.scrollIntoView({ behavior: 'smooth' }); });
  show(root.querySelector('#orgSel').textContent);
} };

/* ════════════ PRODUCTS & FEATURES ════════════ */
V['explore/products'] = { title: 'Products & Features', render: function () {
  var open = P.openFindings();
  return P.pageHead('Explore', 'Products & features', 'Every product and feature with its review state and the findings that touch it. Open a feature to get an auto-built review workbench.') +
    '<div class="grid g3">' + NS.products.map(function (p) {
      var feats = NS.features.filter(function (f) { return f.product === p.id; });
      var sys = NS.systems.filter(function (s) { return s.product === p.id; }).map(function (s) { return s.id; });
      var ds = NS.datasets.filter(function (d) { return d.product === p.id; }).map(function (d) { return d.id; });
      var fs = open.filter(function (f) { return f.entities.some(function (e) { return e === p.id || sys.indexOf(e) >= 0 || ds.indexOf(e) >= 0 || feats.some(function (x) { return x.id === e; }); }); });
      var hi = fs.filter(function (f) { return f.sev === 'HIGH'; }).length;
      return '<div class="card"><div class="card-h"><div><div class="small dim">' + esc(P.name(p.bu)) + '</div><h2 class="sec"><button class="chip" data-ent="' + p.id + '" style="font-size:14px;font-weight:650;color:var(--text)">' + esc(p.name) + '</button></h2></div><div style="text-align:right"><div class="mono ' + (hi ? 'bad' : 'dim') + '">' + hi + ' HIGH</div><div class="small dim">' + fs.length + ' open</div></div></div>' +
        '<div class="small muted" style="margin-bottom:8px">' + (p.users ? fmtN(p.users) + ' users' : 'internal platform') + ' · ' + sys.length + ' systems · ' + ds.length + ' datasets</div>' +
        '<ul class="checks">' + feats.map(function (f) { var r = NS.reviews.filter(function (x) { return x.feature === f.id; })[0]; return '<li><span class="ic">' + (r ? (r.risk === 'HIGH' ? '<span class="bad">●</span>' : r.risk === 'MEDIUM' ? '<span class="warn">●</span>' : '<span class="dim">●</span>') : '<span class="unknown">?</span>') + '</span><span><a href="#/privacy/reviews/' + f.id + '">' + esc(f.name) + '</a> <span class="small dim">' + esc(r ? r.stage.toLowerCase() : 'no review') + '</span></span></li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';
} };

/* ════════════ SYSTEMS ════════════ */
V['explore/systems'] = { title: 'Systems', render: function () {
  var rows = NS.systems.map(function (s) {
    var ds = NS.datasets.filter(function (d) { return d.system === s.id; });
    var t = ds.reduce(function (m, d) { return Math.max(m, P.dsTier(d)); }, 0);
    var out = P.flowsFrom(s.id), eg = out.filter(function (f) { return f.boundary === 'third_party'; }).length;
    var fc = P.openFindings().filter(function (f) { return f.entities.indexOf(s.id) >= 0 || ds.some(function (d) { return f.entities.indexOf(d.id) >= 0; }); }).length;
    return '<tr class="click" data-ent="' + s.id + '" tabindex="0"><td><b>' + esc(s.name) + '</b></td><td class="mono small">' + esc(s.kind) + '</td><td>' + (s.team ? esc(P.name(s.team)) : unk('none')) + '</td><td class="small">' + esc(s.product ? P.name(s.product) : 'shared') + '</td><td class="mono small">' + esc(s.region) + '</td><td>' + (ds.length ? P.tier(t) : '<span class="dim">—</span>') + '</td><td class="num">' + out.length + '</td><td class="num ' + (eg ? 'bad' : '') + '">' + eg + '</td><td class="num ' + (fc ? 'bad' : '') + '">' + fc + '</td></tr>';
  }).join('');
  return P.pageHead('Explore', 'Systems', 'Services, APIs, stores, streams, logs, caches, indexes, backups, feature stores, vector stores and jobs. Logs, caches and backups are systems too: that is where copies hide.') +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>System</th><th>Kind</th><th>Owner</th><th>Product</th><th>Region</th><th>Max tier</th><th class="num">Flows out</th><th class="num">3P egress</th><th class="num">Findings</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
} };

/* ════════════ DATA & CLASSIFICATION ════════════ */
P.tierOff = P.tierOff || {};
var TIERS = [
  ['T0', 'PUBLIC', 'Published prices, public profile fields', 'Integrity checks; no special handling'],
  ['T1', 'INTERNAL', 'Aggregate metrics, config, non-personal logs', 'Access control; standard retention'],
  ['T2', 'PERSONAL', 'Email, device ID, usage events', 'Purpose tags, retention limits, access logging'],
  ['T3', 'SENSITIVE', 'Precise location, contacts, messages, financial data', 'Minimise, encrypt, need-to-know access, short TTL'],
  ['T4', 'SPECIAL', "Health, biometrics, children's data, government IDs", 'Avoid collecting; on-device first; explicit consent; strongest isolation']
];
V['explore/data'] = { title: 'Data', render: function () {
  var fieldsBy = [0, 0, 0, 0, 0], dsBy = [0, 0, 0, 0, 0];
  NS.datasets.forEach(function (d) { d.fields.forEach(function (f) { fieldsBy[f[1]]++; }); dsBy[P.dsTier(d)]++; });
  var cols = TIERS.map(function (t, i) { return '<div class="card flat" style="border-top:3px solid var(--t' + i + ')"><div class="mono small" style="color:' + (i < 2 ? 'var(--muted)' : 'var(--t' + i + ')') + '">' + t[0] + ' · ' + t[1] + '</div><div class="stat-row" style="margin:8px 0"><div class="stat"><div class="sv">' + dsBy[i] + '</div><div class="sl">datasets</div></div><div class="stat"><div class="sv">' + fieldsBy[i] + '</div><div class="sl">fields</div></div></div><div class="small muted">' + esc(t[2]) + '</div><div class="small" style="margin-top:6px"><b>Default controls:</b> ' + esc(t[3]) + '</div></div>'; }).join('');
  var labels = {}; NS.datasets.forEach(function (d) { P.tierControls(d).forEach(function (c) { labels[c[0]] = 1; }); });
  var rows = NS.datasets.slice().sort(function (a, b) { return P.dsTier(b) - P.dsTier(a) || b.people - a.people; }).map(function (d) {
    var tc = P.tierControls(d).filter(function (c) { return !P.tierOff[c[0]]; }), ok = tc.filter(function (c) { return c[1] === true; }).length;
    return '<tr class="click" data-ent="' + d.id + '" tabindex="0"><td><span class="mono">' + esc(d.name) + '</span><div class="small dim">' + esc(P.name(d.system)) + '</div></td><td>' + P.tier(P.dsTier(d)) + '</td><td><div class="fstrip">' + d.fields.map(function (f) { return '<i class="tier-' + f[1] + '" title="' + esc(f[0]) + ' T' + f[1] + '"></i>'; }).join('') + '</div></td><td class="num">' + fmtN(d.people) + '</td><td class="num ' + (ok < tc.length ? 'bad' : 'ok') + '">' + ok + ' / ' + tc.length + '</td><td>' + P.sixStrip(P.six(d)).replace('class="six"', 'class="six mini"') + '</td></tr>';
  }).join('');
  return P.pageHead('Explore', 'Data & classification', 'Tier the data first. The tier decides the default controls, so reviewers debate exceptions, not basics. Controls become stronger as sensitivity rises.') +
    '<div class="grid" style="grid-template-columns:repeat(5,minmax(0,1fr));margin-bottom:14px" id="tierCols">' + cols + '</div>' +
    '<details class="card flat" style="margin-bottom:14px"><summary style="cursor:pointer;font-weight:650">Customise the tier control requirements</summary><p class="small muted">Your organisation decides which default controls each tier requires. Untick one and the compliance column recomputes.</p><div class="chips">' + Object.keys(labels).map(function (l) { return '<label class="tog"><input type="checkbox" data-tierreq="' + esc(l) + '"' + (P.tierOff[l] ? '' : ' checked') + '> ' + esc(l) + '</label>'; }).join('') + '</div></details>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Dataset</th><th>Tier</th><th>Fields by tier</th><th class="num">People</th><th class="num">Tier controls met</th><th>Six questions</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<style>.fstrip{display:flex;gap:2px;flex-wrap:wrap;max-width:190px}.fstrip i{width:12px;height:12px;border-radius:3px}.six.mini{margin:0;gap:2px;min-width:210px}.six.mini div{padding:2px;font-size:9px}@media(max-width:1100px){#tierCols{grid-template-columns:repeat(2,minmax(0,1fr))!important}}</style>';
}, mount: function (root) {
  root.querySelectorAll('[data-tierreq]').forEach(function (cb) { cb.addEventListener('change', function () { P.tierOff[cb.getAttribute('data-tierreq')] = !cb.checked; P._keepScroll = true; P.render(); var d = document.querySelector('details.card'); if (d) d.open = true; }); });
} };

/* ════════════ KNOWLEDGE GRAPH ════════════ */
var LANES = ['bu', 'product', 'feature', 'team', 'endpoint', 'system', 'dataset', 'identifier', 'purpose', 'model', 'vendor', 'subprocessor', 'control', 'finding', 'risk', 'incident', 'regulation'];
var LANE_COL = { bu: '#6b7a93', product: '#1f6ac0', feature: '#1f6ac0', team: '#6f7788', endpoint: '#6f7788', system: '#4f78a8', dataset: '#bd5f14', identifier: '#6346c9', purpose: '#0b7d60', model: '#963bbd', vendor: '#c0470f', subprocessor: '#c0470f', control: '#0b7d60', finding: '#c42d49', risk: '#c42d49', incident: '#c42d49', regulation: '#6f7788' };
P.LANE_COL = LANE_COL;
V['explore/graph'] = { title: 'Knowledge Graph', render: function (s, q) {
  var focus = q.focus && P.get(q.focus) ? q.focus : 'd_fraudfeat', depth = +(q.depth || 2), dir = q.dir || 'both';
  var opts = Object.keys(P.ENT).filter(function (id) { return ['flow', 'consumer', 'tracker', 'pet', 'region'].indexOf(P.get(id).type) < 0; }).sort(function (a, b) { return P.name(a).localeCompare(P.name(b)); });
  return P.pageHead('Explore', 'Privacy knowledge graph', 'Privacy is a relationship problem. Pick any entity and walk forward (where it goes) or backward (where it came from). Relationships people did not realise existed are drawn in coral.') +
    '<div class="toolbar"><label class="small muted" for="gFocus">Focus</label><select id="gFocus">' + opts.map(function (id) { return '<option value="' + esc(id) + '"' + (id === focus ? ' selected' : '') + '>' + esc(P.TYPE_LABEL[P.get(id).type] + ' · ' + P.name(id)) + '</option>'; }).join('') + '</select>' +
    '<div class="seg" role="group" aria-label="Direction">' + [['both', 'Both ways'], ['out', 'Forward →'], ['in', '← Backward']].map(function (d) { return '<button data-gdir="' + d[0] + '" aria-pressed="' + (dir === d[0]) + '">' + d[1] + '</button>'; }).join('') + '</div>' +
    '<div class="seg" role="group" aria-label="Depth">' + [1, 2, 3].map(function (d) { return '<button data-gdepth="' + d + '" aria-pressed="' + (depth === d) + '">' + d + ' hop' + (d > 1 ? 's' : '') + '</button>'; }).join('') + '</div>' +
    '<button class="btn ghost" data-gall="1">Whole organisation</button></div>' +
    '<div class="canvas" id="gCanvas"></div>' +
    '<div class="legend" style="margin-top:10px"><span><i style="background:#1f6ac0"></i>data flow</span><span><i style="background:#c0470f"></i>unsanctioned join / finding</span><span><i style="background:#b9b1a0"></i>structural</span><span><i class="dash"></i>unknown</span><span class="dim">Click a node to focus it and open its passport. Keyboard: Tab to a node, Enter.</span></div>';
}, mount: function (root, s, q) {
  var focus = q.focus && P.get(q.focus) ? q.focus : 'd_fraudfeat', depth = +(q.depth || 2), dir = q.dir || 'both';
  function nav(o) { var n = { focus: focus, depth: depth, dir: dir }; for (var k in o) n[k] = o[k]; P._keepScroll = true; P.go('explore/graph?focus=' + n.focus + '&depth=' + n.depth + '&dir=' + n.dir); }
  root.querySelector('#gFocus').addEventListener('change', function () { nav({ focus: this.value }); });
  root.querySelectorAll('[data-gdir]').forEach(function (b) { b.addEventListener('click', function () { nav({ dir: b.getAttribute('data-gdir') }); }); });
  root.querySelectorAll('[data-gdepth]').forEach(function (b) { b.addEventListener('click', function () { nav({ depth: +b.getAttribute('data-gdepth') }); }); });
  root.querySelector('[data-gall]').addEventListener('click', function () { drawGraph(root.querySelector('#gCanvas'), null, 0, 'both'); });
  drawGraph(root.querySelector('#gCanvas'), focus, depth, dir);
} };
function drawGraph(el, focus, depth, dir) {
  var nodes = {}, edges = [];
  if (focus) {
    nodes[focus] = 0; var frontier = [focus];
    for (var d = 1; d <= depth; d++) {
      var next = [];
      frontier.forEach(function (id) {
        P.EDGES.forEach(function (e) {
          var other = null;
          if ((dir === 'both' || dir === 'out') && e.a === id) other = e.b;
          if ((dir === 'both' || dir === 'in') && e.b === id) other = e.a;
          if (!other) return;
          var t = P.get(other).type; if (d > 1 && (t === 'team' || t === 'bu' || t === 'purpose' || t === 'regulation')) return;
          if (nodes[other] == null) { if (Object.keys(nodes).length > 64) return; nodes[other] = d; next.push(other); }
        });
      });
      frontier = next;
    }
  } else {
    Object.keys(P.ENT).forEach(function (id) { var t = P.get(id).type; if (['product', 'system', 'dataset', 'identifier', 'vendor', 'model', 'finding', 'subprocessor', 'endpoint'].indexOf(t) >= 0) nodes[id] = 1; });
  }
  P.EDGES.forEach(function (e) { if (nodes[e.a] != null && nodes[e.b] != null) edges.push(e); });
  var lanes = {}; Object.keys(nodes).forEach(function (id) { var t = P.get(id).type; (lanes[t] = lanes[t] || []).push(id); });
  var used = LANES.filter(function (l) { return lanes[l]; });
  var all = !focus, colW = all ? 150 : 200, rowH = all ? 17 : 38, nodeW = all ? 128 : 172, top = 40;
  var maxRows = Math.max.apply(null, used.map(function (l) { return lanes[l].length; }));
  var W = Math.max(used.length * colW + 40, 600), H = top + maxRows * rowH + 30;
  var pos = {};
  used.forEach(function (l, i) {
    lanes[l].sort(function (a, b) { return (nodes[a] - nodes[b]) || P.name(a).localeCompare(P.name(b)); });
    var off = (maxRows - lanes[l].length) * rowH / 2;
    lanes[l].forEach(function (id, j) { pos[id] = { x: 20 + i * colW, y: top + off + j * rowH }; });
  });
  var sv = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Knowledge graph' + (focus ? ' around ' + esc(P.name(focus)) : '') + '">';
  used.forEach(function (l, i) { sv += '<text x="' + (20 + i * colW) + '" y="20" fill="#6b6457" font-size="10" font-family="JetBrains Mono" letter-spacing="1">' + esc((P.TYPE_LABEL[l] || l).toUpperCase()) + ' · ' + lanes[l].length + '</text>'; });
  sv += '<g id="gEdges">';
  edges.forEach(function (e) {
    var a = pos[e.a], b = pos[e.b]; if (!a || !b) return;
    var ax = a.x + nodeW, ay = a.y + (all ? 6 : 13), bx = b.x, by = b.y + (all ? 6 : 13);
    if (a.x > b.x) { ax = a.x; bx = b.x + nodeW; }
    if (a.x === b.x) { ax = a.x + nodeW; bx = b.x + nodeW; }
    var mx = a.x === b.x ? ax + 60 : (ax + bx) / 2;
    var col = /unsanctioned/.test(e.rel) ? '#c0470f' : e.rel === 'flows to' ? '#1f6ac0' : e.rel === 'affects' || e.rel === 'evidenced by' ? '#c42d49' : '#b9b1a0';
    var fl = e.x && typeof e.x === 'string' ? P.get(e.x).obj : null;
    var dash = fl && fl.status === 'unknown' ? ' stroke-dasharray="5 4"' : /unsanctioned/.test(e.rel) ? ' stroke-dasharray="4 3"' : '';
    if (fl && fl.status === 'unknown') col = '#6346c9';
    sv += '<path d="M' + ax + ',' + ay + ' C' + mx + ',' + ay + ' ' + mx + ',' + by + ' ' + bx + ',' + by + '" fill="none" stroke="' + col + '" stroke-opacity="' + (all ? 0.28 : 0.7) + '" stroke-width="' + (all ? 0.8 : 1.3) + '"' + dash + ' data-a="' + e.a + '" data-b="' + e.b + '"><title>' + esc(P.name(e.a) + ' — ' + e.rel + ' → ' + P.name(e.b)) + '</title></path>';
  });
  sv += '</g>';
  Object.keys(pos).forEach(function (id) {
    var p = pos[id], e = P.get(id), col = LANE_COL[e.type] || '#6f7788', isF = id === focus;
    var unknownish = (e.type === 'dataset' && !e.obj.owner) || (e.type === 'system' && !e.obj.team && e.type !== 'endpoint') || (e.type === 'subprocessor' && !e.obj.known) || (e.type === 'vendor' && !e.obj.declared);
    var label = e.type === 'finding' ? id : P.name(id); var max = all ? 19 : 25; if (label.length > max) label = label.slice(0, max - 1) + '…';
    if (all) sv += '<g class="node" data-ent="' + id + '" tabindex="0" role="button" aria-label="' + esc(P.TYPE_LABEL[e.type] + ': ' + P.name(id)) + '"><circle cx="' + (p.x + 5) + '" cy="' + (p.y + 6) + '" r="4.5" fill="' + col + '" stroke="' + (unknownish ? '#6346c9' : 'none') + '"/><text x="' + (p.x + 14) + '" y="' + (p.y + 10) + '" fill="#4f5968" font-size="10.5">' + esc(label) + '</text></g>';
    else sv += '<g class="node" data-ent="' + id + '" data-focus="' + id + '" tabindex="0" role="button" aria-label="' + esc(P.TYPE_LABEL[e.type] + ': ' + P.name(id)) + '"><rect x="' + p.x + '" y="' + p.y + '" width="' + nodeW + '" height="26" rx="7" fill="' + (isF ? '#e9f0fa' : '#fffdf9') + '" stroke="' + (isF ? col : unknownish ? '#6346c9' : '#d3cbbb') + '" stroke-width="' + (isF ? 2 : 1) + '"' + (unknownish ? ' stroke-dasharray="4 3"' : '') + '/><rect x="' + p.x + '" y="' + p.y + '" width="4" height="26" rx="2" fill="' + col + '"/><text x="' + (p.x + 11) + '" y="' + (p.y + 17) + '" fill="' + (isF ? '#1d2430' : '#1d2430') + '" font-size="11.5"' + (isF ? ' font-weight="700"' : '') + '>' + esc(label) + '</text></g>';
  });
  el.innerHTML = sv + '</svg>';
  var svg = el.querySelector('svg');
  svg.addEventListener('mouseover', function (ev) { var g = ev.target.closest('.node'); if (!g) return; var id = g.getAttribute('data-ent'); svg.querySelectorAll('#gEdges path').forEach(function (p) { var on = p.getAttribute('data-a') === id || p.getAttribute('data-b') === id; p.style.strokeOpacity = on ? 1 : 0.08; p.style.strokeWidth = on ? 2 : ''; }); });
  svg.addEventListener('mouseout', function () { svg.querySelectorAll('#gEdges path').forEach(function (p) { p.style.strokeOpacity = ''; p.style.strokeWidth = ''; }); });
  if (focus) svg.addEventListener('click', function (ev) { var g = ev.target.closest('.node'); if (!g) return; var id = g.getAttribute('data-ent'); if (id !== focus) setTimeout(function () { P._keepScroll = true; P.go('explore/graph?focus=' + id + '&depth=' + depth + '&dir=' + dir); setTimeout(function () { P.open(id, { noFocus: true }); }, 30); }, 0); });
}

/* ════════════ ONE PERSON — WHAT COULD WE KNOW? ════════════ */
P.personLevers = P.personLevers || {};
V['explore/person'] = { title: 'One Person', render: function () {
  var ps = NS.persona;
  return P.pageHead('Explore · the killer question', 'What could Northstar know about one person?', 'The graph traverses every permitted join, identifier, inference, vendor and model from two starting identifiers — an email address and a device ID — and shows what could theoretically be combined. Then pull the architectural levers and watch the dossier shrink.') +
    '<div class="callout" style="margin-bottom:14px"><b>' + esc(ps.name) + '.</b> ' + esc(ps.blurb) + ' <span class="dim">Starting identifiers: ' + ps.starts.map(P.name).join(', ') + '.</span></div>' +
    '<div class="person"><div><div class="card" style="margin-bottom:14px"><div class="card-h"><h2 class="sec">Portrait assembled by joins</h2><div class="btn-row"><button class="btn primary" id="pTrav">▶ Traverse the graph</button></div></div><div class="canvas" id="pSvg" style="background:var(--bg2)"></div></div>' +
    '<div class="card"><div class="card-h"><h2 class="sec">The dossier</h2><span class="sub" id="pCount"></span></div><ul class="dossier" id="pList"></ul></div></div>' +
    '<div><div class="card" style="margin-bottom:14px"><h2 class="sec" style="margin-bottom:10px">Architecture levers</h2><div style="display:grid;gap:8px" id="pLev">' + ps.levers.map(function (l) { return '<label class="lever' + (P.personLevers[l.id] ? ' on' : '') + '"><input type="checkbox" data-lever="' + l.id + '"' + (P.personLevers[l.id] ? ' checked' : '') + '><span><b>' + esc(l.label) + '</b><br><span class="small muted">' + esc(l.note) + '</span></span></label>'; }).join('') + '</div></div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:10px">Who else can learn it</h2><ul class="checks">' + ps.outside.map(function (o) { return '<li><span class="ic bad">→</span><span><button class="chip" data-ent="' + o.via + '">' + esc(o.who) + '</button><br><span class="small muted">' + esc(o.what) + '</span></span></li>'; }).join('') + '</ul></div></div></div>';
}, mount: function (root) {
  var ps = NS.persona, list = root.querySelector('#pList'), svgEl = root.querySelector('#pSvg');
  function blocked(f) { return f.blockedBy.some(function (b) { return P.personLevers[b]; }); }
  function draw(reveal) {
    var shown = reveal == null ? ps.facts.length : reveal;
    list.innerHTML = ps.facts.map(function (f, i) {
      var g = blocked(f), cls = f.kind === 'UNKNOWABLE' ? 'unkn' : g ? 'gone' : '';
      return '<li class="' + cls + '" style="' + (i >= shown ? 'opacity:0;transform:translateY(4px)' : '') + '"><span>' + P.kind(f.kind === 'UNKNOWABLE' ? 'UNKNOWABLE' : f.kind) + '</span><div><div>' + esc(f.a) + ' ' + P.tier(f.tier) + '</div><div class="path">' + (f.path.length ? f.path.map(P.name).join(' → ') + ' → ' : '') + '<button class="chip" data-ent="' + f.ds + '" style="font-size:10.5px;padding:0 6px">' + esc(P.name(f.ds)) + '</button>' + (f.note ? ' · ' + esc(f.note) : '') + (g ? ' · <span class="ok">removed by ' + f.blockedBy.filter(function (b) { return P.personLevers[b]; }).map(function (b) { return ps.levers.filter(function (l) { return l.id === b; })[0].label.toLowerCase(); }).join(', ') + '</span>' : '') + '</div></div></li>';
    }).join('');
    var live = ps.facts.filter(function (f) { return f.kind !== 'UNKNOWABLE' && !blocked(f); });
    root.querySelector('#pCount').innerHTML = '<b style="color:var(--text)">' + live.length + '</b> things known · ' + live.filter(function (f) { return f.kind === 'INFERENCE'; }).length + ' inferred · <span class="bad">' + live.filter(function (f) { return f.tier === 4; }).length + ' special-category</span>';
    portrait(svgEl, shown);
  }
  function portrait(el, shown) {
    var W = 680, H = 470, cx = W / 2, cy = H / 2 - 6, ids = P.uniq([].concat.apply(ps.starts.slice(), ps.facts.map(function (f) { return f.path; })));
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px;display:block;margin:auto" role="group" aria-label="Identifiers and facts joined around one person">';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="175" fill="none" stroke="#e7e1d5" stroke-dasharray="2 5"/><circle cx="' + cx + '" cy="' + cy + '" r="100" fill="none" stroke="#e7e1d5" stroke-dasharray="2 5"/>';
    var ip = {}; ids.forEach(function (id, i) { var a = -Math.PI / 2 + i * 2 * Math.PI / ids.length; ip[id] = { x: cx + 100 * Math.cos(a), y: cy + 100 * Math.sin(a) }; });
    ps.facts.forEach(function (f, i) {
      var a = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / ps.facts.length, x = cx + 175 * Math.cos(a) * 1.3, y = cy + 175 * Math.sin(a);
      var vis = i < shown, g = blocked(f), unkn = f.kind === 'UNKNOWABLE';
      var col = unkn ? '#6346c9' : ['#9aa1ac', '#6b7a93', '#1f6ac0', '#bd5f14', '#c42d49'][f.tier];
      var from = f.path.length ? ip[f.path[f.path.length - 1]] : { x: cx, y: cy };
      if (vis && !unkn) s += '<line x1="' + from.x.toFixed(1) + '" y1="' + from.y.toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + col + '" stroke-opacity="' + (g ? 0.08 : 0.5) + '"' + (f.kind === 'INFERENCE' ? ' stroke-dasharray="3 3"' : '') + '/>';
      s += '<g opacity="' + (vis ? (g ? 0.18 : 1) : 0) + '" style="transition:opacity .4s"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (4 + f.tier * 1.4) + '" fill="' + col + '"' + (unkn ? ' fill-opacity="0" stroke="#6346c9" stroke-dasharray="2 2"' : '') + '/><title>' + esc(f.a) + '</title></g>';
    });
    ids.forEach(function (id) { var p = ip[id]; s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" stroke="#6346c9" stroke-opacity=".35"/><g class="node" data-ent="' + id + '" tabindex="0" role="button" aria-label="' + esc(P.name(id)) + '"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="13" fill="#f6f3ec" stroke="#6346c9"/><text x="' + p.x.toFixed(1) + '" y="' + (p.y + 25).toFixed(1) + '" fill="#6346c9" font-size="9.5" text-anchor="middle">' + esc(P.name(id).replace(/ \(.*\)/, '')) + '</text></g>'; });
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="26" fill="#e9f0fa" stroke="#1d2430"/><text x="' + cx + '" y="' + (cy + 5) + '" fill="#1d2430" font-size="15" font-weight="700" text-anchor="middle">A.</text>';
    el.innerHTML = s + '<text x="10" y="' + (H - 10) + '" fill="#6b6457" font-size="10">inner ring: identifiers · outer ring: facts & inferences (colour = tier; dashed = inference) · hypothetical person</text></svg>';
  }
  root.querySelectorAll('[data-lever]').forEach(function (cb) { cb.addEventListener('change', function () { P.personLevers[cb.getAttribute('data-lever')] = cb.checked; cb.closest('.lever').classList.toggle('on', cb.checked); draw(); }); });
  root.querySelector('#pTrav').addEventListener('click', function () {
    var i = 0; draw(0); var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { draw(); return; }
    var t = setInterval(function () { i++; draw(i); if (i >= ps.facts.length) clearInterval(t); }, 260);
  });
  draw();
} };

/* ════════════ IDENTITY & LINKABILITY ════════════ */
var CLS = ['GLOBAL DURABLE', 'CROSS-APP', 'PER-VENDOR', 'PURPOSE-SCOPED', 'ROTATING', 'EPHEMERAL', 'NONE'];
var CLS_COL = { 'GLOBAL DURABLE': '#c42d49', 'CROSS-APP': '#c0470f', 'PER-VENDOR': '#946300', 'PURPOSE-SCOPED': '#0b7d60', 'ROTATING': '#1f6ac0', 'EPHEMERAL': '#4f78a8', 'NONE': '#6b6457' };
V['explore/identities'] = { title: 'Identities', render: function () {
  var ids = NS.identifiers, W = 640, H = 520, cx = W / 2, cy = H / 2 + 6, R = 200;
  var pos = {}; ids.forEach(function (i, k) { var a = -Math.PI / 2 + k * 2 * Math.PI / ids.length; pos[i.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a: a }; });
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" role="group" aria-label="Identifier join graph">';
  NS.idJoins.forEach(function (j) {
    if (!j[2] && j[4]) return; var a = pos[j[0]], b = pos[j[1]]; if (!a || !b) return;
    var col = j[4] ? '#b9b1a0' : '#c0470f';
    s += '<path d="M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) + ' Q' + cx + ',' + cy + ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="' + (j[4] ? 1.2 : 2) + '"' + (j[4] ? '' : ' stroke-dasharray="5 4" class="flowdash"') + '><title>' + esc(P.name(j[0]) + ' ↔ ' + P.name(j[1]) + ': ' + j[3]) + '</title></path>';
  });
  ids.forEach(function (i) {
    var p = pos[i.id], c = CLS_COL[i.cls], anchor = Math.cos(p.a) > 0.2 ? 'start' : Math.cos(p.a) < -0.2 ? 'end' : 'middle', dx = anchor === 'start' ? 16 : anchor === 'end' ? -16 : 0, dy = anchor === 'middle' ? (Math.sin(p.a) > 0 ? 26 : -18) : 4;
    s += '<g class="node" data-ent="' + i.id + '" tabindex="0" role="button" aria-label="' + esc(i.name + ', ' + i.cls) + '"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="10" fill="' + c + '" fill-opacity=".25" stroke="' + c + '" stroke-width="2"/><text x="' + (p.x + dx).toFixed(1) + '" y="' + (p.y + dy).toFixed(1) + '" fill="#1d2430" font-size="11.5" text-anchor="' + anchor + '">' + esc(i.name) + '</text></g>';
  });
  s += '</svg>';
  var spectrum = '<div class="spec">' + CLS.map(function (c) { var m = ids.filter(function (i) { return i.cls === c; }); return '<div class="sp" style="border-top:3px solid ' + CLS_COL[c] + '"><div class="mono small" style="color:' + CLS_COL[c] + '">' + c + '</div>' + (m.length ? m.map(function (i) { return chip(i.id); }).join('') : '<span class="dim small">—</span>') + '</div>'; }).join('') + '</div>';
  var un = NS.idJoins.filter(function (j) { return !j[4]; });
  return P.pageHead('Explore', 'Identity & linkability', 'Every stable key is a thread that stitches contexts together. Solid grey joins are sanctioned; dashed coral joins happen without anyone having decided they should.') +
    '<div class="callout warn" style="margin-bottom:14px"><b>Health App Device ID ↕ Advertising Warehouse Device ID.</b> The Pulse SDK sends the device ID and the advertising ID in one beacon, and the identity job joins the Pulse user ID to both. Harm: cross-context linkage, sensitive inference, re-identification. ' + chip('PRV-0233') + '</div>' +
    '<div class="grid g-main"><div class="card"><div class="card-h"><h2 class="sec">Join graph</h2><span class="sub">' + un.length + ' unsanctioned joins</span></div>' + s + '<div class="legend"><span><i style="background:#b9b1a0"></i>sanctioned join</span><span><i style="background:#c0470f"></i>unsanctioned join</span></div></div>' +
    '<div class="card"><h2 class="sec" style="margin-bottom:6px">Unsanctioned joins</h2><p class="small muted">Ask everywhere: can we use a weaker, rotating, scoped or purpose-specific identifier?</p><div class="tbl-wrap"><table class="tbl"><tbody>' + un.map(function (j) { return '<tr><td>' + chip(j[0]) + '<br>' + chip(j[1]) + '</td><td class="small">' + esc(j[3]) + '<div class="dim">in ' + (j[2] ? esc(P.name(j[2])) : '—') + '</div></td></tr>'; }).join('') + '</tbody></table></div></div></div>' +
    '<div class="card" style="margin-top:14px"><div class="card-h"><h2 class="sec">◀ More linkable · less linkable ▶</h2><span class="sub">choose the weakest identifier that still does the job</span></div>' + spectrum + '</div>' +
    '<style>.spec{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.sp{background:var(--panel);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:5px;align-items:flex-start}@media(max-width:1100px){.spec{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>';
} };

/* ════════════ DATA FLOW + TRUST BOUNDARY MAP ════════════ */
var FP = { n_app: [80, 210], n_web: [80, 430], s_pulsesdk: [80, 640],
  s_gateway: [255, 330], s_payment: [440, 50], s_checkout: [440, 140], s_location: [440, 230], s_browse: [440, 320], s_nova: [440, 420], s_supportsvc: [440, 520], s_msg: [440, 610], s_pulseapi: [440, 700],
  s_fraudsvc: [630, 70], s_bus: [630, 160], s_lochist: [630, 250], s_capi: [630, 340], s_novalogs: [630, 430], s_logs: [255, 470], s_linkprev: [630, 610],
  s_fraudfs: [815, 70], s_wh: [815, 190], s_lochist_eu: [815, 290], s_idres: [815, 390], s_insights: [815, 490], s_novamem: [815, 580],
  mdl_fraud: [1000, 40], s_mktg: [1000, 130], s_audsvc: [1000, 250], s_adswh: [1000, 360], s_backup: [1000, 470], n_dash: [1000, 560],
  v_vaultline: [1210, 50], v_adreach: [1210, 150], v_geogrid: [1210, 250], v_pixelpeak: [1210, 330], v_clearsight: [1210, 410], v_lumen: [1210, 490], v_helphub: [1210, 580], sp_llmco: [1210, 670] };
V['explore/flows'] = { title: 'Data Flows', render: function (s, q) {
  var toggles = [['third', 'Third-party egress'], ['trust', 'Trust-boundary crossings'], ['region', 'Cross-region'], ['join', 'New identity joins'], ['purpose', 'Purpose changes'], ['sensitive', 'Sensitive joins'], ['unrev', 'Unreviewed'], ['unknown', 'Unknown flows']];
  return P.pageHead('Explore', 'Data flow & trust boundaries', '<b>Every arrow is a decision.</b> Each one is a privacy object with fields, identifier, purpose, consent, retention, region, recipient, contract, control and deletion behaviour. Click any arrow.') +
    '<div class="toolbar">' + toggles.map(function (t) { return '<label class="tog"><input type="checkbox" data-ftog="' + t[0] + '"> ' + t[1] + '</label>'; }).join('') + '</div>' +
    '<div class="canvas" id="fCanvas"></div>' +
    '<div class="legend" style="margin-top:10px"><span><i style="background:#9aa1ac"></i>reviewed</span><span><i style="background:#c0470f"></i>leaves Northstar</span><span><i style="background:#946300"></i>purpose change</span><span><i class="dash"></i>unknown — nobody described it</span><span class="dim">Line width = sensitivity tier.</span></div>';
}, mount: function (root, s, q) {
  var W = 1340, H = 750, el = root.querySelector('#fCanvas');
  function flowCol(f) { if (f.status === 'unknown') return '#6346c9'; if ((f.flags || []).indexOf('purpose_change') >= 0) return '#946300'; if (f.boundary === 'third_party') return '#c0470f'; return '#9aa1ac'; }
  function match(f, k) {
    var fl = f.flags || [];
    return { third: f.boundary === 'third_party', trust: f.boundary === 'trust' || f.boundary === 'third_party' || f.boundary === 'device', region: f.regionFrom !== f.regionTo && f.regionTo !== 'user' && f.regionFrom !== 'user' && f.regionFrom !== 'device', join: fl.indexOf('identity_join') >= 0, purpose: fl.indexOf('purpose_change') >= 0, sensitive: fl.indexOf('sensitive_join') >= 0 || f.tier >= 4, unrev: f.status === 'unreviewed', unknown: f.status === 'unknown' }[k];
  }
  var sv = '<svg width="100%" style="min-width:980px;height:auto" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Northstar data-flow map with trust boundaries"><defs>' +
    ['5d6a7f', 'ff8a5c', 'f2c46d', 'b39bff', 'e9edf3'].map(function (c) { return '<marker id="ar' + c + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#' + c + '"/></marker>'; }).join('') + '</defs>';
  [[10, 10, 160, 730, 'USER DEVICE', '#1f6ac0'], [185, 10, 915, 730, 'NORTHSTAR — YOUR SERVERS', '#0b7d60'], [1130, 10, 200, 730, 'THIRD PARTIES', '#c0470f'], [930, 105, 170, 300, 'ADVERTISING CONTEXT', '#946300']].forEach(function (z) {
    sv += '<rect x="' + z[0] + '" y="' + z[1] + '" width="' + z[2] + '" height="' + z[3] + '" rx="14" fill="' + z[5] + '" fill-opacity=".035" stroke="' + z[5] + '" stroke-opacity=".35" stroke-dasharray="6 5"/><text x="' + (z[0] + 12) + '" y="' + (z[1] + z[3] - 10) + '" fill="' + z[5] + '" fill-opacity=".8" font-size="10" font-family="JetBrains Mono" letter-spacing="1.5">' + z[4] + '</text>';
  });
  sv += '<g id="fEdges">';
  NS.flows.forEach(function (f) {
    var a = FP[f.from], b = FP[f.to]; if (!a || !b) return;
    var ax = a[0] + 62, ay = a[1] + 15, bx = b[0] - 62, by = b[1] + 15;
    if (b[0] < a[0]) { ax = a[0] - 62; bx = b[0] + 62; }
    if (Math.abs(b[0] - a[0]) < 10) { ax = a[0]; ay = a[1] + (b[1] > a[1] ? 30 : 0); bx = b[0]; by = b[1] + (b[1] > a[1] ? 0 : 30); }
    var mx = (ax + bx) / 2, d = Math.abs(b[0] - a[0]) < 10 ? 'M' + ax + ',' + ay + ' L' + bx + ',' + by : 'M' + ax + ',' + ay + ' C' + mx + ',' + ay + ' ' + mx + ',' + by + ' ' + bx + ',' + by;
    var c = flowCol(f), dash = f.status === 'unknown' ? ' stroke-dasharray="6 5"' : f.status === 'unreviewed' ? ' stroke-dasharray="2 4"' : '';
    sv += '<g class="edge" data-ent="' + f.id + '" data-fid="' + f.id + '" tabindex="0" role="button" aria-label="Flow ' + esc(P.name(f.id)) + ', ' + esc(f.fields.join(', ')) + '"><path class="hit" d="' + d + '"/><path class="vis' + (f.status === 'unknown' ? ' flowdash' : '') + '" d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + (0.8 + f.tier * 0.55) + '" stroke-opacity=".85"' + dash + ' marker-end="url(#ar' + c.slice(1) + ')"/><title>' + esc(f.id + ': ' + f.fields.join(', ')) + '</title></g>';
  });
  sv += '</g>';
  Object.keys(FP).forEach(function (id) {
    var p = FP[id], e = P.get(id); if (!e) return;
    var t = e.type, col = t === 'vendor' || t === 'subprocessor' ? '#c0470f' : t === 'endpoint' ? '#1f6ac0' : t === 'model' ? '#963bbd' : '#4f78a8';
    var unknownish = (t === 'system' && !e.obj.team) || (t === 'vendor' && !e.obj.declared) || (t === 'subprocessor' && !e.obj.known);
    var label = P.name(id).replace(' (user device)', '').replace('Event Bus · purchase-events', 'Event Bus'); if (label.length > 21) label = label.slice(0, 20) + '…';
    sv += '<g class="node" data-ent="' + id + '" tabindex="0" role="button" aria-label="' + esc(P.name(id)) + '"><rect x="' + (p[0] - 62) + '" y="' + p[1] + '" width="124" height="30" rx="8" fill="#fffdf9" stroke="' + (unknownish ? '#6346c9' : '#d3cbbb') + '"' + (unknownish ? ' stroke-dasharray="4 3"' : '') + '/><rect x="' + (p[0] - 62) + '" y="' + p[1] + '" width="3.5" height="30" rx="2" fill="' + col + '"/><text x="' + p[0] + '" y="' + (p[1] + 19) + '" fill="#1d2430" font-size="11" text-anchor="middle">' + esc(label) + '</text></g>';
  });
  el.innerHTML = sv + '</svg>';
  function apply() {
    var on = [].slice.call(root.querySelectorAll('[data-ftog]:checked')).map(function (c) { return c.getAttribute('data-ftog'); });
    el.querySelectorAll('.edge').forEach(function (g) {
      var f = P.get(g.getAttribute('data-fid')).obj, hit = !on.length || on.some(function (k) { return match(f, k); });
      g.classList.toggle('dim-out', !hit);
    });
  }
  root.querySelectorAll('[data-ftog]').forEach(function (c) { c.addEventListener('change', apply); });
  if (q.f && P.get(q.f)) {
    var g = el.querySelector('[data-fid="' + q.f + '"]');
    el.querySelectorAll('.edge').forEach(function (x) { if (x !== g) x.classList.add('dim-out'); });
    if (g) { g.querySelector('.vis').setAttribute('stroke-width', '4'); var a = FP[P.get(q.f).obj.from]; if (a) el.scrollLeft = Math.max(0, a[0] - 200); }
  }
} };

/* ════════════ VENDOR EGRESS GRAPH ════════════ */
V['explore/vendors'] = { title: 'Vendor Egress', render: function () {
  var eg = NS.flows.filter(function (f) { var t = P.get(f.to); return t && (t.type === 'vendor' || t.type === 'subprocessor'); });
  var srcs = P.uniq(eg.filter(function (f) { return P.get(f.from).type !== 'vendor'; }).map(function (f) { return f.from; }));
  var vs = NS.vendors.map(function (v) { return v.id; });
  var sps = NS.subprocessors.map(function (s) { return s.id; });
  var W = 1100, rowS = 44, H = Math.max(srcs.length, vs.length, sps.length) * rowS + 60, x0 = 20, x1 = 440, x2 = 860, nw = 190;
  function ys(arr, id) { var off = (H - 40 - arr.length * rowS) / 2; return 30 + off + arr.indexOf(id) * rowS; }
  var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Egress graph: Northstar systems to vendors to subprocessors">';
  [[x0, 'NORTHSTAR SOURCE'], [x1, 'VENDOR / PROCESSOR / PARTNER'], [x2, 'SUBPROCESSOR / DESTINATION']].forEach(function (c) { s += '<text x="' + c[0] + '" y="16" fill="#6b6457" font-size="10" font-family="JetBrains Mono" letter-spacing="1">' + c[1] + '</text>'; });
  function ribbon(xa, ya, xb, yb, w, col, op, dash, ent) { var mx = (xa + xb) / 2; return '<path class="edge" data-ent="' + ent + '" d="M' + xa + ',' + ya + ' C' + mx + ',' + ya + ' ' + mx + ',' + yb + ' ' + xb + ',' + yb + '" fill="none" stroke="' + col + '" stroke-opacity="' + op + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="6 4"' : '') + ' style="cursor:pointer"><title>' + esc(P.name(ent)) + '</title></path>'; }
  eg.forEach(function (f) {
    var fromV = P.get(f.from).type === 'vendor';
    var xa = (fromV ? x1 : x0) + nw, ya = (fromV ? ys(vs, f.from) : ys(srcs, f.from)) + 14, xb = fromV ? x2 : x1, yb = (fromV ? ys(sps, f.to) : ys(vs, f.to)) + 14;
    var v = P.get(fromV ? f.from : f.to).obj, w = Math.max(2, Math.sqrt((v.people || 1e5) / 1e6) * 2.6);
    s += ribbon(xa, ya, xb, yb, w, f.status === 'unknown' ? '#6346c9' : f.tier >= 3 ? '#c0470f' : '#1f6ac0', 0.45, f.status === 'unknown', f.id);
  });
  NS.vendors.forEach(function (v) { v.subprocessors.forEach(function (sp) { if (eg.some(function (f) { return f.from === v.id && f.to === sp; })) return; s += ribbon(x1 + nw, ys(vs, v.id) + 14, x2, ys(sps, sp) + 14, 1.2, P.get(sp).obj.known ? '#b9b1a0' : '#6346c9', 0.6, !P.get(sp).obj.known, v.id); }); });
  function node(x, y, id, sub, bad, unkn) { return '<g class="node" data-ent="' + id + '" tabindex="0" role="button" aria-label="' + esc(P.name(id)) + '"><rect x="' + x + '" y="' + y + '" width="' + nw + '" height="28" rx="7" fill="#fffdf9" stroke="' + (unkn ? '#6346c9' : bad ? '#c0470f' : '#d3cbbb') + '"' + (unkn ? ' stroke-dasharray="4 3"' : '') + '/><text x="' + (x + 10) + '" y="' + (y + 18) + '" fill="#1d2430" font-size="11.5">' + esc(P.name(id).slice(0, 24)) + '</text>' + (sub ? '<text x="' + (x + nw - 8) + '" y="' + (y + 18) + '" fill="' + (bad ? '#c0470f' : '#6b6457') + '" font-size="9.5" text-anchor="end" font-family="JetBrains Mono">' + esc(sub) + '</text>' : '') + '</g>'; }
  srcs.forEach(function (id) { s += node(x0, ys(srcs, id), id, '', false, false); });
  var iss = {}; P.vendorIssues().forEach(function (x) { iss[x.v.id] = x.issues; });
  NS.vendors.forEach(function (v) { s += node(x1, ys(vs, v.id), v.id, iss[v.id].length ? iss[v.id].length + ' ⚑' : '✓', iss[v.id].length > 1, !v.declared); });
  NS.subprocessors.forEach(function (sp) { s += node(x2, ys(sps, sp.id), sp.id, sp.region, false, !sp.known); });
  s += '</svg>';
  var det = [['Undeclared vendor', NS.vendors.filter(function (v) { return !v.declared; })], ['Unknown subprocessor', NS.vendors.filter(function (v) { return v.subprocessors.some(function (x) { return !P.get(x).obj.known; }); })], ['Expired / expiring agreement', NS.vendors.filter(function (v) { return v.contract && P.daysUntil(v.contract.expires) < 45; })], ['Sensitive data transfer (T3+)', NS.vendors.filter(function (v) { return v.tier >= 3 && v.id !== 'v_cloudhost'; })], ['Retention mismatch', NS.vendors.filter(function (v) { return v.retention.contract != null && v.retention.actual > v.retention.contract; })], ['Opt-out not propagated', NS.vendors.filter(function (v) { return !v.optOutPropagates; })], ['No deletion mechanism', NS.vendors.filter(function (v) { return !v.deletionApi; })]];
  return P.pageHead('Explore', 'Vendor egress graph', 'Northstar → vendor → subprocessor → destination. Ribbon width ≈ people affected; coral = sensitive; violet dashed = nobody can say who or where.') +
    '<div class="canvas">' + s + '</div>' +
    '<div class="grid g4" style="margin-top:14px">' + det.map(function (d) { return '<div class="card flat"><div class="card-h"><h3 style="margin:0">' + esc(d[0]) + '</h3><span class="mono ' + (d[1].length ? 'bad' : 'ok') + '">' + d[1].length + '</span></div>' + P.chips(d[1].map(function (v) { return v.id; })) + '</div>'; }).join('') + '</div>';
} };

/* ════════════ GEOGRAPHY ════════════ */
var LAND = [
  [[-168, 65], [-140, 70], [-95, 72], [-80, 63], [-60, 55], [-52, 47], [-66, 44], [-75, 35], [-81, 25], [-97, 26], [-105, 20], [-95, 16], [-85, 10], [-78, 8], [-83, 15], [-92, 18], [-105, 23], [-117, 32], [-124, 40], [-125, 49], [-135, 57], [-152, 58], [-165, 62]],
  [[-55, 60], [-43, 60], [-20, 70], [-20, 80], [-60, 82], [-70, 76]],
  [[-80, 8], [-60, 10], [-50, 0], [-35, -5], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-72, -50], [-75, -40], [-71, -18], [-81, -5]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [0, 50], [5, 54], [8, 57], [5, 62], [15, 69], [28, 71], [40, 67], [45, 55], [40, 45], [28, 41], [22, 36], [15, 38], [12, 44], [3, 42]],
  [[-6, 50], [2, 51], [0, 53], [-3, 56], [-6, 58], [-5, 54]], [[-10, 52], [-6, 52], [-6, 55], [-10, 54]],
  [[-17, 21], [-10, 30], [-5, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [40, -5], [40, -15], [33, -26], [20, -35], [15, -28], [12, -15], [9, -1], [5, 5], [-8, 5], [-15, 10]],
  [[28, 41], [40, 45], [45, 55], [40, 67], [60, 70], [80, 73], [110, 76], [140, 72], [170, 68], [180, 65], [160, 58], [140, 54], [135, 43], [122, 40], [120, 30], [110, 20], [106, 10], [100, 14], [98, 8], [103, 2], [95, 16], [92, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 25], [52, 28], [48, 30], [56, 24], [58, 20], [52, 16], [43, 13], [35, 28], [35, 33], [36, 37]],
  [[130, 31], [141, 36], [142, 45], [139, 40]], [[95, 5], [105, -6], [115, -8], [120, -5], [125, 1], [118, 5], [108, 2]],
  [[114, -22], [122, -18], [131, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [140, -38], [132, -32], [115, -34]],
  [[172, -35], [178, -38], [174, -41], [167, -46]], [[44, -25], [50, -15], [49, -12], [43, -17]]
];
function inPoly(x, y, poly) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; }
V['explore/geo'] = { title: 'Geography', render: function (s, q) {
  var W = 1000, H = 470, proj = function (lon, lat) { return [(lon + 180) / 360 * W, (78 - lat) / (78 + 58) * H]; };
  var dots = '';
  for (var lat = 76; lat > -56; lat -= 2.6) for (var lon = -178; lon < 180; lon += 2.6) { for (var k = 0; k < LAND.length; k++) if (inPoly(lon, lat, LAND[k])) { var p = proj(lon, lat); dots += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="1.5"/>'; break; } }
  var tf = q.t || 'all';
  var tr = NS.transfers.filter(function (t) { return tf === 'all' || (tf === 'sens' && t.tier >= 3) || (tf === 'unrev' && !t.reviewed) || (tf === 'eu' && /^eu/.test(t.from) && !/^eu/.test(t.to)); });
  var RP = {}; NS.regions.forEach(function (r) { RP[r.id] = proj(r.lon, r.lat); });
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="group" aria-label="World map of Northstar data regions and cross-border transfers"><g fill="#d3cbbb">' + dots + '</g>';
  NS.geoUsers.forEach(function (g) { var p = RP[g.region]; svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (6 + Math.sqrt(g.people / 1e6) * 2.2).toFixed(1) + '" fill="#1f6ac0" fill-opacity=".10" stroke="#1f6ac0" stroke-opacity=".3"/>'; });
  tr.forEach(function (t) {
    var a = RP[t.from], b = RP[t.to], mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - Math.abs(a[0] - b[0]) * 0.22 - 20;
    var col = t.to === 'unknown' || t.basis === 'unknown' || t.basis === 'none' || t.basis === 'none on file' ? '#6346c9' : t.tier >= 3 && !t.reviewed ? '#c0470f' : t.tier >= 3 ? '#946300' : '#0b7d60';
    svg += '<path d="M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' Q' + mx.toFixed(1) + ',' + my.toFixed(1) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="' + (1 + t.tier * 0.5) + '" stroke-opacity=".8"' + (col === '#6346c9' ? ' stroke-dasharray="5 4" class="flowdash"' : '') + (t.flow ? ' data-ent="' + t.flow + '" style="cursor:pointer"' : '') + '><title>' + esc(t.from + ' → ' + t.to + ': ' + t.what + ' (basis: ' + t.basis + ')') + '</title></path>';
  });
  NS.regions.forEach(function (r) { var p = RP[r.id], col = r.kind === 'store' ? '#0b7d60' : r.kind === 'vendor' ? '#c0470f' : r.kind === 'unknown' ? '#6346c9' : r.kind === 'process' ? '#946300' : '#1f6ac0'; svg += '<g class="node" data-ent="' + r.id + '" tabindex="0" role="button" aria-label="' + esc(r.label) + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="' + col + '"' + (r.kind === 'unknown' ? ' fill-opacity="0" stroke="#6346c9" stroke-dasharray="2 2"' : '') + '/><text x="' + (p[0] + 8) + '" y="' + (p[1] - 6) + '" fill="#3a4250" font-size="10.5">' + esc(r.label.split(' — ')[0].split(' (')[0]) + '</text></g>'; });
  svg += '</svg>';
  return P.pageHead('Explore', 'Geography & data residency', 'Where people are, where data originates, where it is stored and processed, and where vendors receive it. Blue halos = users; teal = storage; amber = processing; coral = vendor; violet = unknown destination.') +
    '<div class="toolbar"><div class="seg" role="group" aria-label="Filter transfers">' + [['all', 'All transfers'], ['sens', 'Sensitive (T3+)'], ['unrev', 'Unreviewed'], ['eu', 'Leaves Europe']].map(function (x) { return '<button data-go="explore/geo?t=' + x[0] + '" aria-pressed="' + (tf === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="card" style="padding:8px">' + svg + '</div>' +
    '<div class="tbl-wrap" style="margin-top:14px"><table class="tbl"><thead><tr><th>From</th><th>To</th><th>What</th><th>Tier</th><th>Transfer basis</th><th>Reviewed</th></tr></thead><tbody>' + tr.map(function (t) { return '<tr' + (t.flow ? ' class="click" data-ent="' + t.flow + '" tabindex="0"' : '') + '><td class="mono small">' + esc(t.from) + '</td><td class="mono small">' + (t.to === 'unknown' ? unk() : esc(t.to)) + '</td><td>' + esc(t.what) + '</td><td>' + P.tier(t.tier) + '</td><td>' + (/unknown|none/.test(t.basis) ? unk(t.basis) : esc(t.basis)) + '</td><td>' + (t.reviewed ? '<span class="ok">yes</span>' : '<span class="bad">no</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<p class="small dim">Map is schematic. Transfer bases are illustrative and not legal advice.</p>';
} };
})();
