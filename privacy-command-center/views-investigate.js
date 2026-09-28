/* Views: INVESTIGATE — lineage and purpose, vendors and geography, AI/ML and
 * agents, Worst Day, and the Risk radar.
 *
 * Every page answers one investigator's question and exposes the chain around
 * it (promise → … → owner). Nothing here types a number: counts, bands and
 * verdicts are computed from data.js, data-ops.js and data-ai.js. Unknowns are
 * shown as findings (P.unk). Risk is shown as a band in words with its
 * drivers, safeguards, unknowns and confidence (P.explainRisk) — never as a
 * bare score. Every diagram has a legend and a table beside it.
 *
 * Loaded after views-explore.js / views-privacy.js / views-assurance.js, so
 * the routes defined here are the ones the router uses. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk, fmtDays = P.fmtDays, uniq = P.uniq;
var V = P.views, ENT = P.ENT;

/* ═════════════ shared helpers ═════════════ */
function ent(id) { return ENT[id] ? ENT[id].obj : null; }
function typeOf(id) { return ENT[id] ? ENT[id].type : null; }
function isVendorish(id) { var t = typeOf(id); return t === 'vendor' || t === 'subprocessor'; }
function isOpen(f) { return P.isOpenFinding ? P.isOpenFinding(f) : ['closed', 'mitigated', 'accepted'].indexOf(f.status) < 0; }
function pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function hd(iso, none) { return iso ? esc(P.hdate(iso)) : unk(none || 'no date recorded'); }
function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1).replace(/[\s·&(,-]+$/, '') + '…' : s; }
function purposeLabel(p) { return p === 'unknown' ? 'unknown purpose' : ENT[p] && ENT[p].obj.label ? ENT[p].obj.label : p; }
function purposeChip(p) { return p === 'unknown' || !ENT[p] ? unk('unknown purpose') : chip(p, purposeLabel(p)); }
function tierOf(d) { return P.dsTier(d); }
function listJoin(a) { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
function section(id, title, body, sub) {
  return '<section class="iv-sec" aria-labelledby="' + id + '"><div class="iv-sec-h"><h2 id="' + id + '" class="sec">' + esc(title) + '</h2>' + (sub ? '<p class="small dim">' + sub + '</p>' : '') + '</div>' + body + '</section>';
}
function scrollBox(label, inner, cls) { return '<div class="iv-scroll' + (cls ? ' ' + cls : '') + '" tabindex="0" role="region" aria-label="' + esc(label) + '">' + inner + '</div>'; }
/* A table that scrolls sideways must be a named, focusable region. The
 * router labels what overflows at first render; this also covers tables
 * that start overflowing later (a details opened, a result redrawn). */
function labelScrollers(root) {
  root.querySelectorAll('.tbl-wrap').forEach(function (el) {
    if (el.scrollWidth <= el.clientWidth + 1 || el.getAttribute('aria-label')) return;
    var cap = el.querySelector('caption');
    el.tabIndex = 0; el.setAttribute('role', 'region'); el.setAttribute('aria-label', (cap ? cap.textContent : 'Table') + ' — scrolls sideways');
  });
}
function wire(root) {
  labelScrollers(root);
  root.querySelectorAll('details').forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) labelScrollers(d); }); });
}
function marker(id, color) { return '<marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + color + '"/></marker>'; }
var C = { ok: '#8a8272', third: '#b3400b', drift: '#7a5200', unknown: '#6346c9', info: '#1f6ac0', ctl: '#0b7d60', pseudo: '#6b6457', mem: '#7d3aa6', text: '#1d2430', dim: '#5b5448', paper: '#fffdf9', line: '#d5cfc2' };

/* Promises that bear on any of the given records, and how to show them. */
function promisesOf(ids) { var out = []; ids.forEach(function (i) { if (!ENT[i]) return; P.promisesFor(i).forEach(function (p) { if (out.indexOf(p) < 0) out.push(p); }); }); return out; }
function promiseList(ps, empty) {
  if (!ps.length) return '<p class="small">' + unk(empty || 'no published promise covers this') + '</p>';
  return '<ul class="iv-proms">' + ps.map(function (p) {
    var st = P.promiseState(p);
    return '<li>' + P.statusTag(st.status) + ' <a href="#/promises/' + esc(p.id) + '"><q>' + esc(p.text) + '</q></a> <span class="mono small dim">' + esc(p.id) + '</span>' +
      (p.decision ? ' <span class="small dim">· decision</span> ' + chip(p.decision, p.decision) : '') + '</li>';
  }).join('') + '</ul>';
}

/* ═════════════ agents join the graph ═════════════ */
P.TYPE_LABEL.agent = 'Agent';
(NS.agents || []).forEach(function (a) {
  ENT[a.id] = { id: a.id, type: 'agent', obj: a, name: a.name };
});
(NS.agents || []).forEach(function (a) {
  var e = function (x, y, rel) { if (ENT[x] && ENT[y] && x !== y) P.EDGES.push({ a: x, b: y, rel: rel, x: null }); };
  e(a.id, a.model, 'runs on'); e(a.id, a.team, 'owned by'); e(a.id, a.purpose, 'serves');
  a.tools.forEach(function (t) { t.data.forEach(function (d) { e(a.id, d, t.kind === 'read' ? 'reads' : 'acts on'); }); if (isVendorish(t.system)) e(a.id, t.system, 'sends to'); });
  a.findings.forEach(function (f) { e(f, a.id, 'affects'); });
});
/* An agent's chain is its model's chain, plus the data its tools touch. */
var baseChain = P.chain;
P.chain = function (id) {
  var e = ENT[id];
  if (!e || e.type !== 'agent') return baseChain(id);
  var c = baseChain(e.obj.model); if (!c) return c;
  var cols = {}; Object.keys(c.cols).forEach(function (k) { cols[k] = c.cols[k].slice(); });
  e.obj.tools.forEach(function (t) { t.data.forEach(function (d) { if (cols.data.indexOf(d) < 0) cols.data.push(d); }); if (isVendorish(t.system) && cols.recipient.indexOf(t.system) < 0) cols.recipient.push(t.system); });
  e.obj.findings.forEach(function (f) { if (cols.finding.indexOf(f) < 0) cols.finding.push(f); });
  if (cols.owner.indexOf(e.obj.team) < 0) cols.owner.unshift(e.obj.team);
  return { from: id, cols: cols, missingOwner: c.missingOwner };
};

/* ═════════════ AI sources and stages ═════════════ */
var STAGES = [['training', 'Training'], ['fineTune', 'Fine-tuning'], ['rag', 'Retrieval (RAG)'], ['vector', 'Vector store'], ['memory', 'Memory']];
var CONVO = (NS.aiConversationData || []).map(function (x) { return x.ds; });
/* Which datasets feed a model, by stage. */
P.aiSources = function (m) {
  var x = (NS.aiModels || {})[m.id] || {}, ft = x.fineTune || [];
  var vec = m.vector ? NS.datasets.filter(function (d) { return d.system === m.vector; }).map(function (d) { return d.id; }) : [];
  var rag = (x.rag || []).filter(function (d) { return vec.indexOf(d) < 0; });
  return { training: m.training.filter(function (d) { return ft.indexOf(d) < 0; }), fineTune: ft.slice(), rag: rag, vector: vec, memory: (x.memory || []).slice() };
};
P.aiAllSources = function (m) { var s = P.aiSources(m); return uniq([].concat(s.training, s.fineTune, s.rag, s.vector, s.memory)); };
P.aiHoldsConversations = function (m) { return P.aiAllSources(m).filter(function (d) { return CONVO.indexOf(d) >= 0; }); };
function hostingOf(m) { return m.provider !== 'in-house' && m.hosting !== 'ON DEVICE' && m.hosting !== 'ISOLATED PRIVATE CLOUD' ? 'THIRD-PARTY MODEL' : m.hosting; }
var HOST_TEXT = { 'ON DEVICE': 'On the person’s device', 'ISOLATED PRIVATE CLOUD': 'Isolated private cloud', 'INTERNAL CLOUD': 'Northstar cloud', 'THIRD-PARTY MODEL': 'Third-party provider' };

/* ═════════════ LINEAGE ═════════════ */
function toks(list) { return String(list.join(' ')).toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean); }
function passAll(fl) { return /\ball\b|snapshot/i.test(fl.fields.join(' ')); }
function carriesT(fl, t) { if (passAll(fl)) return true; return toks(fl.fields).some(function (x) { return t.indexOf(x) >= 0; }); }
function baseToks(d) { return d.fields.map(function (f) { return f[0].toLowerCase(); }).concat([d.name.toLowerCase()]); }
function collectedFor(d) { var h = (NS.purposeHistory || []).filter(function (x) { return x.ds === d.id; })[0]; return h ? h.collected : d.purposes; }
/* Where a dataset's records come from and everywhere they go, hop by hop.
 * A hop counts when the flow carries one of the dataset's fields (or all of
 * them); later hops follow the fields that actually arrived. */
P.lineage = function (dsId) {
  var d = ent(dsId); if (!d) return null;
  var base = baseToks(d), depth = {}, up = [], down = [], pseudo = [], order = [d.system], hop = {};
  depth[d.system] = 0;
  var o = (NS.origins || {})[dsId], seed = [d.system];
  if (o && o.from && o.from !== d.system && ENT[o.from] && !NS.flows.some(function (fl) { return fl.from === o.from && fl.to === d.system; })) {
    pseudo.push({ pseudo: 'origin', from: o.from, to: d.system, text: o.how }); depth[o.from] = -1; order.push(o.from);
    if (o.kind === 'derived' || o.kind === 'inferred') seed.push(o.from);
  }
  /* downstream */
  var q = seed.map(function (n) { return { n: n, t: base }; }), seen = {};
  seed.forEach(function (n) { seen[n] = 1; });
  while (q.length) {
    var c = q.shift();
    NS.flows.forEach(function (fl) {
      if (fl.from !== c.n || down.indexOf(fl) >= 0 || !carriesT(fl, c.t)) return;
      down.push(fl); hop[fl.id] = Math.max(0, depth[c.n]);
      var nt = passAll(fl) || toks(fl.fields).indexOf(d.name.toLowerCase()) >= 0 ? c.t : toks(fl.fields);
      if (depth[fl.to] == null) { depth[fl.to] = Math.max(1, depth[c.n] + 1); order.push(fl.to); }
      if (!seen[fl.to]) { seen[fl.to] = 1; q.push({ n: fl.to, t: nt }); }
    });
  }
  /* upstream */
  var qu = [{ n: d.system, t: base }].concat(pseudo.length ? [{ n: o.from, t: base }] : []), seenU = {};
  qu.forEach(function (x) { seenU[x.n] = 1; });
  while (qu.length) {
    var u = qu.shift();
    NS.flows.forEach(function (fl) {
      if (fl.to !== u.n || up.indexOf(fl) >= 0 || down.indexOf(fl) >= 0 || !carriesT(fl, u.t)) return;
      up.push(fl);
      if (depth[fl.from] == null) { depth[fl.from] = Math.min(-1, depth[u.n] - 1); order.push(fl.from); }
      if (!seenU[fl.from]) { seenU[fl.from] = 1; qu.push({ n: fl.from, t: u.t.concat(toks(fl.fields)) }); }
    });
  }
  /* models trained on it, agents that use it */
  NS.models.forEach(function (m) {
    var s = P.aiSources(m), st = STAGES.filter(function (x) { return s[x[0]].indexOf(dsId) >= 0; })[0];
    if (!st || down.some(function (fl) { return fl.to === m.id; })) return;
    pseudo.push({ pseudo: 'model', from: d.system, to: m.id, text: st[1] + ' data for ' + m.name, stage: st[0] });
    if (depth[m.id] == null) { depth[m.id] = 1; order.push(m.id); }
  });
  (NS.agents || []).forEach(function (a) {
    var tl = a.tools.filter(function (t) { return t.data.indexOf(dsId) >= 0; });
    if (!tl.length) return;
    pseudo.push({ pseudo: 'agent', from: d.system, to: a.id, text: tl.map(function (t) { return t.name; }).join('; ') });
    if (depth[a.id] == null) { depth[a.id] = 1; order.push(a.id); }
  });
  var dests = uniq(down.map(function (fl) { return fl.to; }));
  return { d: d, up: up, down: down, pseudo: pseudo, depth: depth, order: order, origin: o || null, hop: hop,
    dests: dests, vendors: dests.filter(isVendorish), copies: uniq(down.filter(function (fl) { return fl.tier >= 2 && ['system', 'vendor', 'subprocessor'].indexOf(typeOf(fl.to)) >= 0; }).map(function (fl) { return fl.to; })) };
};
/* A downstream flow is a use of the data. Its purpose is compared with the
 * purpose at collection on the first hop (deeper hops serve the data they
 * arrive in); a flow flagged as a purpose change counts wherever it is.
 * Backups are storage and aggregates carry no person, so neither is a use. */
function useDrift(L, fl) {
  if ((fl.flags || []).indexOf('purpose_change') >= 0) return true;
  if (fl.purpose === 'unknown' || L.hop[fl.id] > 0 || fl.retention === 'aggregate') return false;
  if (typeOf(fl.to) === 'system' && ent(fl.to).kind === 'backup') return false;
  return collectedFor(L.d).indexOf(fl.purpose) < 0;
}
function flowClass(fl, L, isDown) {
  if (fl.status === 'unknown') return 'unknown';
  if ((fl.flags || []).indexOf('purpose_change') >= 0) return 'drift';
  if (isDown && L && useDrift(L, fl)) return 'drift';
  if (fl.boundary === 'third_party') return 'third';
  return 'ok';
}
var FLOW_WORD = { unknown: 'nobody has described it', drift: 'used for a purpose it was not collected for', third: 'leaves Northstar', ok: 'reviewed, inside Northstar' };
function nodeCol(id) { var t = typeOf(id); return t === 'vendor' || t === 'subprocessor' ? C.third : t === 'endpoint' ? C.info : t === 'model' ? C.mem : t === 'agent' ? C.ctl : '#4f78a8'; }
function nodeUnknownish(id) { var e = ent(id), t = typeOf(id); return !!e && ((t === 'system' && !e.team) || (t === 'vendor' && !e.declared) || (t === 'subprocessor' && !e.known)); }

/* The map: one column per hop, the dataset's store in the middle. */
function lineageSVG(L, sel) {
  var d = L.d, cols = {}, W, H, NW = 156, NH = 38, CW = 200, RH = 54, PAD = 26;
  L.order.forEach(function (id) { var k = L.depth[id]; (cols[k] = cols[k] || []).push(id); });
  var keys = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; });
  var pos = {}, maxRows = Math.max.apply(null, keys.map(function (k) { return cols[k].length; }));
  W = keys.length * CW + PAD; H = Math.max(3, maxRows) * RH + 70;
  keys.forEach(function (k, ci) { var col = cols[k], off = (H - 40 - col.length * RH) / 2; col.forEach(function (id, ri) { pos[id] = [PAD / 2 + ci * CW, 34 + off + ri * RH]; }); });
  var s = '<svg class="iv-map" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Lineage of ' + esc(d.name) + ': where it comes from and where it goes">' +
    '<defs>' + ['ok', 'third', 'drift', 'unknown', 'pseudo'].map(function (k) { return marker('lg-' + k, C[k]); }).join('') + '</defs>';
  keys.forEach(function (k, ci) { var x = PAD / 2 + ci * CW; s += '<text x="' + (x + 2) + '" y="16" fill="' + C.dim + '" font-size="10" font-family="JetBrains Mono" letter-spacing="1">' + (k < 0 ? 'UPSTREAM ' + (-k) : k === 0 ? 'STORED IN' : 'HOP ' + k) + '</text>'; });
  function path(a, b) {
    var p = pos[a], q = pos[b]; if (!p || !q) return null;
    if (q[0] > p[0]) { var x1 = p[0] + NW, y1 = p[1] + NH / 2, x2 = q[0] - 2, y2 = q[1] + NH / 2, mx = (x1 + x2) / 2; return 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2; }
    var bx = p[0] + NW / 2, by = p[1] + NH, cx = q[0] + NW / 2, cy = q[1] + NH + 2, dip = Math.max(by, cy) + 34;
    return 'M' + bx + ',' + by + ' C' + bx + ',' + dip + ' ' + cx + ',' + dip + ' ' + cx + ',' + cy;
  }
  L.pseudo.forEach(function (e) {
    var dd = path(e.from, e.to); if (!dd) return;
    s += '<path d="' + dd + '" fill="none" stroke="' + C.pseudo + '" stroke-width="1.3" stroke-dasharray="1.5 4" stroke-linecap="round" marker-end="url(#lg-pseudo)"><title>' + esc(e.text) + '</title></path>';
  });
  L.up.concat(L.down).forEach(function (fl) {
    var dd = path(fl.from, fl.to); if (!dd) return;
    var k = flowClass(fl, L, L.down.indexOf(fl) >= 0), on = !sel || sel === fl.id;
    var dash = fl.status === 'unknown' ? ' stroke-dasharray="7 5"' : fl.status === 'unreviewed' ? ' stroke-dasharray="3 3"' : '';
    s += '<g class="edge' + (sel === fl.id ? ' iv-sel' : '') + (on ? '' : ' dim-out') + '" data-ent="' + fl.id + '" tabindex="0" role="button" aria-label="' + esc('Flow ' + fl.id + ': ' + P.name(fl.from) + ' to ' + P.name(fl.to) + ', ' + FLOW_WORD[k] + (fl.status !== 'reviewed' ? ', ' + fl.status : '')) + '">' +
      '<path class="hit" d="' + dd + '"/><path class="vis" d="' + dd + '" fill="none" stroke="' + C[k] + '" stroke-width="' + (sel === fl.id ? 4 : 1.2 + fl.tier * 0.5) + '"' + dash + ' marker-end="url(#lg-' + k + ')"/><title>' + esc(fl.id + ' · ' + fl.fields.join(', ')) + '</title></g>';
  });
  Object.keys(pos).forEach(function (id) {
    var p = pos[id], centre = id === d.system, unkn = nodeUnknownish(id), col = nodeCol(id);
    var label = trunc(P.name(id).replace(' (user device)', ''), 24);
    s += '<g class="node"' + (centre ? ' data-centre="1"' : '') + ' data-ent="' + esc(id) + '" tabindex="0" role="button" aria-label="' + esc((centre ? 'Stored in ' : '') + P.name(id) + (unkn ? ' (owner or declaration unknown)' : '')) + '"><title>' + esc(P.name(id)) + '</title>' +
      '<rect x="' + p[0] + '" y="' + p[1] + '" width="' + NW + '" height="' + NH + '" rx="8" fill="' + C.paper + '" stroke="' + (centre ? C.text : unkn ? C.unknown : C.line) + '" stroke-width="' + (centre ? 1.6 : 1) + '"' + (unkn ? ' stroke-dasharray="4 3"' : '') + '/>' +
      '<rect x="' + p[0] + '" y="' + p[1] + '" width="4" height="' + NH + '" rx="2" fill="' + col + '"/>' +
      '<text x="' + (p[0] + 12) + '" y="' + (p[1] + (centre ? 16 : 23)) + '" fill="' + C.text + '" font-size="11.5"' + (centre ? ' font-weight="650"' : '') + '>' + esc(label) + '</text>' +
      (centre ? '<text x="' + (p[0] + 12) + '" y="' + (p[1] + 30) + '" fill="' + C.dim + '" font-size="10" font-family="JetBrains Mono">' + esc(trunc(d.name, 24)) + '</text>' : '') + '</g>';
  });
  return s + '</svg>';
}
function lineageLegend() {
  return '<div class="legend iv-legend" aria-label="Map legend">' +
    '<span><i style="background:' + C.ok + '"></i>reviewed, inside Northstar</span><span><i style="background:' + C.third + '"></i>leaves Northstar</span>' +
    '<span><i style="background:' + C.drift + '"></i>used for a purpose it was not collected for</span><span><i class="dash"></i>nobody has described it</span>' +
    '<span><i class="iv-dot3"></i>unreviewed</span><span><i class="iv-dotp"></i>written, trained on or used by an agent (not a network flow)</span><span class="dim">Line width = sensitivity tier. Select any arrow or box for its record.</span></div>';
}
function hopRows(L, sel) {
  var d = L.d, rows = [];
  L.up.forEach(function (fl) { rows.push({ fl: fl, dir: 'upstream' }); });
  L.pseudo.filter(function (e) { return e.pseudo === 'origin'; }).forEach(function (e) { rows.push({ ps: e, dir: 'origin' }); });
  L.down.forEach(function (fl) { rows.push({ fl: fl, dir: 'downstream' }); });
  L.pseudo.filter(function (e) { return e.pseudo !== 'origin'; }).forEach(function (e) { rows.push({ ps: e, dir: e.pseudo === 'model' ? 'model' : 'agent' }); });
  return '<div class="tbl-wrap iv-hops"><table class="tbl iv-tbl"><caption class="sr-only">Every hop in the lineage of ' + esc(d.name) + '</caption><thead><tr><th scope="col">Hop</th><th scope="col">What moves</th><th scope="col">Transformation</th><th scope="col">Why (purpose at use)</th><th scope="col">Region</th><th scope="col">Kept there</th><th scope="col">Control · status</th></tr></thead><tbody>' +
    rows.map(function (r) {
      if (r.ps) return '<tr class="iv-ps"><td><span class="tag">' + esc(r.dir) + '</span> ' + chip(r.ps.from) + ' → ' + chip(r.ps.to) + '</td><td colspan="6" class="small">' + esc(r.ps.text) + '</td></tr>';
      var fl = r.fl, k = flowClass(fl, L, r.dir === 'downstream'), tr = (NS.transforms || {})[fl.id];
      return '<tr class="' + (sel === fl.id ? 'iv-selrow' : '') + '" data-flow="' + fl.id + '"><td><span class="tag">' + esc(r.dir) + '</span> ' + chip(fl.id, fl.id) + '<div class="small">' + esc(P.name(fl.from)) + ' → ' + esc(P.name(fl.to)) + '</div></td>' +
        '<td class="small mono">' + esc(fl.fields.join(', ')) + ' ' + P.tier(fl.tier) + '</td>' +
        '<td class="small">' + (tr ? esc(tr) : unk(fl.status === 'unknown' ? 'nobody has described this hop' : 'no transformation recorded')) + '</td>' +
        '<td>' + purposeChip(fl.purpose) + (k === 'drift' ? ' <span class="tag sev-HIGH">not collected for this</span>' : '') + '</td>' +
        '<td class="small nowrap">' + esc(fl.regionFrom) + ' → ' + (fl.regionTo === 'unknown' ? unk() : esc(fl.regionTo)) + '</td>' +
        '<td class="small">' + (/unknown/.test(fl.retention) ? unk() : esc(fl.retention)) + '</td>' +
        '<td class="small">' + (fl.control ? chip(fl.control) : unk('no control')) + ' <span class="tag ' + (fl.status === 'reviewed' ? 'sev-GOOD' : 'k-UNKNOWN') + '">' + esc(fl.status) + '</span></td></tr>';
    }).join('') + '</tbody></table></div>';
}
function originCard(L) {
  var d = L.d, o = L.origin;
  var KIND = { provided: 'Provided by the person', observed: 'Observed as they use a product', derived: 'Derived from other data', inferred: 'Inferred — a guess about the person', sdk: 'Collected by third-party code', copy: 'A copy of other data' };
  var upSources = uniq(L.up.map(function (fl) { return fl.from; })).filter(function (x) { return !L.up.some(function (fl) { return fl.to === x; }); });
  return '<div class="card"><h3 class="iv-h3">Where it came from</h3>' +
    (o ? '<p><span class="tag">' + esc(KIND[o.kind] || o.kind) + '</span> ' + esc(o.how) + '</p>' +
      P.kv([['Arrives from', chip(o.from)], ['Basis at collection', o.basis ? esc(o.basis) : unk('no basis recorded')], ['Collected for', collectedFor(d).length ? collectedFor(d).map(purposeChip).join(' ') : unk('no declared purpose')],
        ['Earliest source', upSources.length ? upSources.map(function (x) { return chip(x); }).join(' ') : chip(o.from)], ['People', d.people ? fmtN(d.people) + ' ' + esc((d.subjects || '').toLowerCase()) : unk('none yet, or unknown')]])
      : '<p>' + unk('No origin recorded: nobody can say where these records come from') + '</p>') +
    P.cite([d.id, o && o.from].filter(Boolean), 'Records') + '</div>';
}
function accessCard(L) {
  var d = L.d, ags = (NS.agents || []).filter(function (a) { return a.tools.some(function (t) { return t.data.indexOf(d.id) >= 0; }); });
  var ev = (NS.accessEvents || []).filter(function (x) { return JSON.stringify(x).indexOf(d.id) >= 0; });
  return '<div class="card"><h3 class="iv-h3">Who can access it</h3>' + P.kv([
    ['People who can read it', d.accessPeople == null ? unk('access list unknown') : '<b>' + fmtN(d.accessPeople) + '</b>' + (d.accessPeople > 100 ? ' <span class="bad">— broad</span>' : '')],
    ['Services that read it', d.accessServices == null ? unk() : fmtN(d.accessServices)],
    ['Owner', P.ownerHTML(d.owner)], ['Keys held by', /unknown/.test(d.keyOwner) ? unk('key holder unknown') : esc(d.keyOwner)], ['Encryption', esc(d.encryption)],
    ['AI agents with a tool on it', ags.length ? ags.map(function (a) { var t = a.tools.filter(function (x) { return x.data.indexOf(d.id) >= 0; }); return chip(a.id) + ' <span class="small dim">' + esc(t.map(function (x) { return x.name.toLowerCase() + ' (' + (x.approval === 'none' ? 'no approval' : x.approval) + ')'; }).join('; ')) + '</span>'; }).join('<br>') : '<span class="dim">none</span>'],
    ['Recipients outside Northstar', L.vendors.length ? L.vendors.map(function (v) { return chip(v); }).join(' ') : '<span class="ok">none</span>']]) +
    (ev.length ? '<p class="small dim">Recent access signals: ' + ev.length + '.</p>' : '') + P.cite([d.id].concat(ags.map(function (a) { return a.id; })).concat(L.vendors), 'Records') + '</div>';
}
function joinsCard(L) {
  var d = L.d, ids = P.dsIds(d);
  var js = NS.idJoins.filter(function (j) { return ids.indexOf(j[0]) >= 0 || ids.indexOf(j[1]) >= 0; });
  var bad = js.filter(function (j) { return !j[4]; });
  var strong = ids.filter(function (i) { return ENT[i] && /DURABLE|CROSS/.test(ENT[i].obj.cls); });
  var others = NS.datasets.filter(function (x) { return x.id !== d.id && P.dsIds(x).some(function (i) { return strong.indexOf(i) >= 0; }); });
  return '<div class="card"><h3 class="iv-h3">What it can be joined with</h3>' +
    '<p class="small">' + (ids.length ? 'Identifiers in it: ' + ids.map(function (i) { return chip(i) + ' <span class="small dim">' + esc(ENT[i] ? ENT[i].obj.cls.toLowerCase() : '') + '</span>'; }).join(' ') : '<span class="ok">No identifiers: aggregate only.</span>') + '</p>' +
    (js.length ? joinTable(bad, 'Unsanctioned joins') + (js.length > bad.length ? '<details class="iv-more"><summary>' + pl(js.length - bad.length, 'sanctioned join') + '</summary>' + joinTable(js.filter(function (j) { return j[4]; }), 'Sanctioned joins') + '</details>' : '') : '<p class="small dim">No recorded joins on its identifiers.</p>') +
    '<p class="small">' + (bad.length ? '<b class="bad">' + pl(bad.length, 'unsanctioned join') + '</b> can link it to other contexts. ' : 'Every recorded join is sanctioned. ') +
    (others.length ? pl(others.length, 'other dataset') + ' share a durable or cross-app identifier with it, so could be joined to it by anyone with access to both.' : '') + '</p>' +
    P.cite(ids.concat(bad.map(function (j) { return j[2]; }).filter(Boolean)), 'Records') + '</div>';
}
function joinTable(js, cap) {
  if (!js.length) return '<p class="small ok">No unsanctioned joins on its identifiers.</p>';
  return '<div class="tbl-wrap"><table class="tbl iv-tbl"><caption class="sr-only">' + esc(cap) + '</caption><thead><tr><th scope="col">Join</th><th scope="col">Where · how</th><th scope="col">Sanctioned?</th></tr></thead><tbody>' + js.map(function (j) {
    return '<tr><td>' + chip(j[0]) + ' ↔ ' + chip(j[1]) + '</td><td class="small">' + (j[2] ? esc(P.name(j[2])) + ' · ' : '') + esc(j[3]) + '</td><td>' + (j[4] ? '<span class="ok">sanctioned</span>' : '<span class="tag sev-HIGH">not sanctioned</span>') + '</td></tr>';
  }).join('') + '</tbody></table></div>';
}
function expiryCard(L) {
  var d = L.d, r = d.retention, over = r.required > 0 && r.actual != null && r.actual > r.required;
  var line = r.note ? 'Lives ' + esc(r.note) + (r.ttl ? '; removal is automatic.' : '; nothing removes it automatically.')
    : r.required == null ? unk('No declared retention — nobody has said when it should disappear')
    : 'Declared need: <b>' + esc(fmtDays(r.required)) + '</b>. ' + (r.ttl ? 'A TTL deletes older records automatically.' : '<span class="bad">Nothing deletes it automatically.</span>');
  return '<div class="card"><h3 class="iv-h3">When it expires</h3><p>' + line + '</p>' + P.kv([
    ['Oldest record today', r.actual == null && d.age == null ? unk('unknown') : '<span class="' + (over ? 'bad' : '') + '">' + esc(fmtDays(r.actual != null ? r.actual : d.age) || 'none') + '</span>' + (over ? ' — longer than the declared need' : '')],
    ['Deletion method', /unknown/.test(d.deletion) ? unk('unknown') : esc(d.deletion)], ['Deletion verified', d.deletionVerified ? '<span class="ok">yes</span>' : '<span class="bad">no</span>'],
    ['Last audit', d.lastAudit ? hd(d.lastAudit) + ' <span class="small dim">(' + esc(P.rel(d.lastAudit)) + ')</span>' : unk('never audited')],
    ['Copies elsewhere', L.copies.length ? L.copies.map(function (x) { return chip(x); }).join(' ') + '<div class="small dim">Each copy needs its own expiry and deletion.</div>' : '<span class="ok">none found</span>']]) + P.cite([d.id].concat(L.copies), 'Records') + '</div>';
}
/* What changed: schema changes, new destinations, use-time purpose drift. */
P.lineageChanges = function (L) {
  var d = L.d, out = [], near = [d.id, d.system].concat(L.dests, L.down.map(function (f) { return f.id; }), L.up.map(function (f) { return f.id; }));
  (NS.schemaChanges || []).filter(function (x) { return x.ds === d.id; }).forEach(function (x) {
    out.push({ kind: 'schema', date: x.date, text: (x.change === 'added' ? 'New field' + (x.fields.length > 1 ? 's' : '') + ': ' : 'Re-keyed: ') + x.fields.join(', ') + ' — ' + x.via + '. Gate: ' + x.gate + '.', ids: [x.finding].filter(Boolean), gap: !x.finding });
  });
  NS.drift.filter(function (x) { return ['new consumer', 'new vendor', 'new region', 'new join', 'new sdk', 'new purpose', 'broader access', 'changed retention'].indexOf(x.type) >= 0 && x.entities.some(function (e) { return near.indexOf(e) >= 0; }); }).forEach(function (x) {
    out.push({ kind: x.type === 'new purpose' ? 'purpose' : 'destination', date: x.t.slice(0, 10), text: x.text + ' (' + x.before + ' → ' + x.after + ')', ids: x.entities.filter(function (e) { return ENT[e] && typeOf(e) === 'finding'; }) });
  });
  L.down.filter(function (fl) { return useDrift(L, fl) && fl.status !== 'unknown'; }).forEach(function (fl) {
    var f = NS.findings.filter(function (x) { return isOpen(x) && x.entities.indexOf(fl.id) >= 0 && /PURPOSE|LINKAB/.test(x.kind); })[0];
    out.push({ kind: 'purpose', date: f ? f.opened : null, text: 'At use: ' + P.name(fl.to) + ' reads it for ' + purposeLabel(fl.purpose) + ', which it was not collected for (collected for ' + collectedFor(d).map(purposeLabel).join(', ') + ').' + (fl.status !== 'reviewed' ? ' The flow is ' + fl.status + '.' : ''), ids: [fl.id].concat(f ? [f.id] : []), gap: !f, fl: fl.id });
  });
  L.up.concat(L.down).filter(function (fl) { return fl.status !== 'reviewed' && !out.some(function (x) { return x.fl === fl.id; }); }).forEach(function (fl) {
    var f = NS.findings.filter(function (x) { return isOpen(x) && x.entities.indexOf(fl.id) >= 0; })[0];
    out.push({ kind: 'destination', date: f ? f.opened : null, text: (fl.status === 'unknown' ? 'Undescribed flow' : 'Unreviewed flow') + ': ' + P.name(fl.from) + ' → ' + P.name(fl.to) + ' (' + fl.fields.join(', ') + ').', ids: [fl.id].concat(f ? [f.id] : []), gap: !f });
  });
  (NS.purposeHistory || []).filter(function (x) { return x.ds === d.id; }).forEach(function (h) { h.added.forEach(function (a) { out.push({ kind: 'purpose', date: a.date, text: purposeLabel(a.purpose) + ' was added to its declared purposes after collection, on the basis of ' + a.basis + '.', ids: [d.id], gap: false }); }); });
  return out.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
};
var CH_WORD = { schema: 'Schema change', destination: 'New or undescribed destination', purpose: 'Purpose drift at use' };
function changesCard(L) {
  var ch = P.lineageChanges(L);
  var by = function (k) { return ch.filter(function (x) { return x.kind === k; }).length; };
  return '<div class="card"><h3 class="iv-h3">Changes detected</h3><p class="small">' + ['schema', 'destination', 'purpose'].map(function (k) { return '<span class="tag' + (by(k) ? ' sev-HIGH' : '') + '">' + by(k) + ' · ' + esc(CH_WORD[k].toLowerCase()) + '</span>'; }).join(' ') + '</p>' +
    (ch.length ? '<ol class="iv-changes">' + ch.map(function (x) {
      return '<li class="iv-ch iv-ch-' + x.kind + '"><span class="iv-ch-k">' + esc(CH_WORD[x.kind]) + '</span><span class="iv-ch-d">' + (x.date ? esc(P.hdate(x.date)) : unk('date unknown')) + '</span><p>' + esc(x.text) + '</p>' +
        (x.ids.length ? '<p class="small">' + x.ids.map(function (i) { return chip(i, typeOf(i) === 'finding' || typeOf(i) === 'flow' ? i : null); }).join(' ') + '</p>' : '') + (x.gap && !x.ids.some(function (i) { return typeOf(i) === 'finding'; }) ? '<p class="small">' + unk('no finding opened for this change') + '</p>' : '') + '</li>';
    }).join('') + '</ol>' : '<p class="small ok">No schema change, new destination or purpose drift recorded for this data.</p>') + '</div>';
}
function lineagePick(sel) {
  var groups = [['Personal data', NS.datasets.filter(function (d) { return tierOf(d) >= 2; })], ['Other data', NS.datasets.filter(function (d) { return tierOf(d) < 2; })]];
  return '<form class="iv-pick" onsubmit="return false"><label for="ivDs">Follow a dataset</label><select id="ivDs">' + groups.filter(function (g) { return g[1].length; }).map(function (g) {
    return '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (d) { return '<option value="' + d.id + '"' + (d.id === sel ? ' selected' : '') + '>' + esc(d.name + ' — ' + P.name(d.system)) + '</option>'; }).join('') + '</optgroup>';
  }).join('') + '</select></form>';
}
function allFlowsTable() {
  return '<div class="tbl-wrap"><table class="tbl iv-tbl"><caption class="sr-only">Every data flow at Northstar</caption><thead><tr><th scope="col">Flow</th><th scope="col">From → to</th><th scope="col">Fields</th><th scope="col">Purpose</th><th scope="col">Boundary</th><th scope="col">Status</th></tr></thead><tbody>' +
    NS.flows.map(function (fl) {
      return '<tr><td><a href="#/explore/flows?f=' + fl.id + '" class="mono small">' + fl.id + '</a></td><td class="small">' + esc(P.name(fl.from)) + ' → ' + esc(P.name(fl.to)) + '</td><td class="small mono">' + esc(fl.fields.join(', ')) + '</td><td>' + purposeChip(fl.purpose) + '</td><td class="small">' + esc(fl.boundary.replace('_', ' ')) + '</td><td><span class="tag ' + (fl.status === 'reviewed' ? 'sev-GOOD' : 'k-UNKNOWN') + '">' + esc(fl.status) + '</span></td></tr>';
    }).join('') + '</tbody></table></div>';
}
function defaultDataset() {
  var f = P.openFindings().filter(function (x) { return /PURPOSE DRIFT/.test(x.kind) && x.sev === 'HIGH'; }).sort(function (a, b) { return b.people - a.people; })[0];
  var ds = f && f.entities.filter(function (e) { return typeOf(e) === 'dataset'; })[0];
  return ds || NS.datasets[0].id;
}
function datasetForFlow(fid) {
  var fl = ent(fid); if (!fl) return null;
  var here = NS.datasets.filter(function (d) { return d.system === fl.from && carriesT(fl, baseToks(d)); })[0];
  if (here) return here.id;
  for (var i = 0; i < NS.datasets.length; i++) { var L = P.lineage(NS.datasets[i].id); if (L.down.indexOf(fl) >= 0 || L.up.indexOf(fl) >= 0) return NS.datasets[i].id; }
  return null;
}
V['explore/flows'] = { title: 'Lineage & flows', render: function (s, q) {
  var selFlow = q.f && typeOf(q.f) === 'flow' ? q.f : null;
  var dsId = q.d && typeOf(q.d) === 'dataset' ? q.d : selFlow ? datasetForFlow(selFlow) || defaultDataset() : defaultDataset();
  var L = P.lineage(dsId), d = L.d, ch = P.lineageChanges(L);
  P.pushTrail(dsId);
  var drift = ch.filter(function (x) { return x.kind === 'purpose'; }).length;
  var ps = promisesOf([dsId].concat(L.down.map(function (f) { return f.id; })));
  var answer = '<p class="iv-answer"><b>' + esc(d.name) + '</b> is stored in ' + esc(P.name(d.system)) + '. It arrives through ' + pl(L.up.length + L.pseudo.filter(function (e) { return e.pseudo === 'origin'; }).length, 'hop') + ' and moves on through ' + pl(L.down.length, 'hop') + ' to ' + pl(L.dests.length, 'destination') +
    (L.vendors.length ? ', <b>' + L.vendors.length + ' outside Northstar</b>' : '') + '. ' + (drift ? '<b class="bad">' + pl(drift, 'purpose change') + ' at use.</b> ' : '') +
    (ch.filter(function (x) { return x.kind === 'schema'; }).length ? pl(ch.filter(function (x) { return x.kind === 'schema'; }).length, 'schema change') + ' recorded. ' : '') + '</p>' +
    P.cite([dsId].concat(L.up.map(function (f) { return f.id; }), L.down.map(function (f) { return f.id; })), 'Built from');
  var fsel = selFlow ? '<div class="callout iv-flowsel"><b>Selected arrow ' + esc(selFlow) + ':</b> ' + esc(P.name(selFlow)) + ' — ' + esc(FLOW_WORD[flowClass(ent(selFlow), L, L.down.indexOf(ent(selFlow)) >= 0)]) + '. ' + chip(selFlow, 'Open its record') + ' <a class="small" href="#/explore/flows?d=' + dsId + '">clear selection</a></div>' : '';
  return P.pageHead('Investigate', 'Lineage & flows', 'Follow one dataset end to end: where it came from, every transformation on the way, why it moved, who can read it, what it can be joined with and when it expires — and what changed recently. Every arrow is a decision; select one for its record.', lineagePick(dsId)) +
    answer + fsel +
    '<div class="card iv-mapcard"><div class="card-h"><h2 class="sec">Lineage map · ' + esc(d.name) + '</h2><span class="sub">left: where it comes from · right: where it goes</span></div>' + lineageLegend() +
      scrollBox('Lineage map of ' + d.name + '; scrolls sideways', lineageSVG(L, selFlow), 'canvas iv-canvas') +
      '<h3 class="iv-h3 iv-mt">Every hop, as a table</h3>' + hopRows(L, selFlow) + '</div>' +
    '<div class="grid g2 iv-mt">' + originCard(L) + accessCard(L) + '</div>' +
    '<div class="grid g2 iv-mt">' + expiryCard(L) + joinsCard(L) + '</div>' +
    '<div class="iv-mt">' + changesCard(L) + '</div>' +
    '<div class="card iv-mt"><h3 class="iv-h3">Promises this data is covered by</h3>' + promiseList(ps) + '<h3 class="iv-h3 iv-mt">From promise to owner</h3>' + P.chainHTML(dsId) + '</div>' +
    '<details class="iv-more iv-mt"><summary>Every data flow at Northstar (' + NS.flows.length + ')</summary>' + allFlowsTable() + '</details>';
}, mount: function (root) {
  wire(root);
  var s = root.querySelector('#ivDs'); if (s) s.addEventListener('change', function () { P.go('explore/flows?d=' + encodeURIComponent(s.value)); });
  /* open the map on the arrow asked about, or on the store itself */
  var box = root.querySelector('.iv-canvas'), sel = root.querySelector('.iv-map .iv-sel') || root.querySelector('.iv-map .node[data-centre]');
  if (sel && box && box.scrollWidth > box.clientWidth) { var r = sel.getBBox(); box.scrollLeft = Math.max(0, r.x - box.clientWidth / 3); }
} };

/* ═════════════ PURPOSE: at collection vs at use ═════════════ */
/* Every observed use of a dataset, with what it is used for. */
P.purposeUses = function (d) {
  var L = P.lineage(d.id), uses = [];
  L.down.filter(function (fl) { return (L.hop[fl.id] === 0 && fl.tier >= 2 && fl.retention !== 'aggregate' && !(typeOf(fl.to) === 'system' && ent(fl.to).kind === 'backup')) || (fl.flags || []).indexOf('purpose_change') >= 0 || fl.purpose === 'unknown'; })
    .forEach(function (fl) { uses.push({ purpose: fl.purpose, via: fl.id, kind: 'flow', text: 'flows to ' + P.name(fl.to) }); });
  NS.models.forEach(function (m) {
    var s = P.aiSources(m), st = STAGES.filter(function (x) { return s[x[0]].indexOf(d.id) >= 0; })[0]; if (!st) return;
    var p = CONVO.indexOf(d.id) >= 0 && (st[0] === 'training' || st[0] === 'fineTune') ? 'model_training' : m.purpose;
    uses.push({ purpose: p, via: m.id, kind: 'model', text: st[1].toLowerCase() + ' data for ' + m.name });
  });
  (NS.agents || []).forEach(function (a) { a.tools.filter(function (t) { return t.data.indexOf(d.id) >= 0; }).forEach(function (t) { uses.push({ purpose: t.purpose || a.purpose, via: a.id, kind: 'agent', text: a.name + ': ' + t.name.toLowerCase() }); }); });
  NS.findings.filter(function (f) { return /PURPOSE DRIFT/.test(f.kind) && isOpen(f) && f.entities.filter(function (e) { return typeOf(e) === 'dataset'; })[0] === d.id; }).forEach(function (f) {
    var ps = f.entities.filter(function (e) { return typeOf(e) === 'flow'; }).map(function (e) { return ent(e).purpose; })
      .concat([].concat.apply([], f.entities.filter(function (e) { return typeOf(e) === 'dataset' && e !== d.id; }).map(function (e) { return ent(e).purposes; })));
    uniq(ps).forEach(function (p) { uses.push({ purpose: p, via: f.id, kind: 'finding', text: f.title }); });
  });
  var col = collectedFor(d);
  uses.forEach(function (u) { u.verdict = u.purpose === 'unknown' ? 'unknown' : col.indexOf(u.purpose) >= 0 ? 'ok' : d.purposes.indexOf(u.purpose) >= 0 ? 'added' : 'drift'; });
  return uses;
};
var VERDICT = { ok: 'matches collection', added: 'declared only after collection', drift: 'not collected for this', unknown: 'purpose unknown' };
function purposeEnforcement(d) {
  var cs = NS.controls.filter(function (c) { return c.domain === 'Purpose' && (c.scope === d.system || (d.product && ENT[d.product] && c.scope.toLowerCase().indexOf(P.name(d.product).toLowerCase().split(' ')[0]) >= 0)); });
  if (!cs.length) return unk('not checked at use');
  return cs.map(function (c) { return chip(c.id) + ' <span class="small dim">L' + c.level + ' ' + esc(P.LEVELS[c.level].toLowerCase()) + '</span>'; }).join(' ');
}
function driftCard(f) {
  var ds = f.entities.filter(function (e) { return typeOf(e) === 'dataset'; })[0], d = ent(ds);
  var fl = f.entities.filter(function (e) { return typeOf(e) === 'flow'; }).map(ent);
  var otherDs = f.entities.filter(function (e) { return typeOf(e) === 'dataset' && e !== ds; }).map(ent);
  var home = d ? [d.system, ent(d.system) && ent(d.system).parent, (NS.origins[d.id] || {}).from] : [];
  var users = fl.map(function (x) { return x.to; }).concat(f.entities.filter(function (e) { return ['system', 'model', 'vendor'].indexOf(typeOf(e)) >= 0; })).filter(function (e) { return home.indexOf(e) < 0; });
  var usePurposes = uniq(fl.map(function (x) { return x.purpose; }).concat([].concat.apply([], otherDs.map(function (x) { return x.purposes; }))));
  var ev = NS.drift.filter(function (x) { return x.entities.indexOf(f.id) >= 0; })[0];
  var ps = promisesOf([f.id]), dec = ps.map(function (p) { return p.decision; }).filter(Boolean)[0];
  var ctrl = f.entities.filter(function (e) { return typeOf(e) === 'control'; });
  var o = d && (NS.origins || {})[d.id];
  return '<article class="card iv-drift" data-finding="' + esc(f.id) + '"><div class="card-h"><div>' + P.sev(f.sev) + ' ' + chip(f.id, f.id) + '</div><span class="sub">' + esc(f.kind.toLowerCase()) + '</span></div>' +
    '<h3 class="iv-h3">' + esc(f.title) + '</h3>' +
    '<div class="iv-cu"><div class="iv-cu-c"><p class="iv-cu-k">At collection</p><p>' + (d ? chip(d.id) : unk('no source dataset recorded')) + '</p><p class="small">Collected for ' + (d ? collectedFor(d).map(purposeChip).join(' ') || unk('no declared purpose') : '—') + '</p>' +
      (o ? '<p class="small dim">' + esc(o.how) + ' Basis: ' + (o.basis ? esc(o.basis) : 'none recorded') + '.</p>' : '') + '</div>' +
      '<div class="iv-cu-arrow" aria-hidden="true">→</div>' +
      '<div class="iv-cu-u"><p class="iv-cu-k">At use</p><p>' + uniq(users).filter(function (x) { return ENT[x]; }).map(function (x) { return chip(x); }).join(' ') + '</p><p class="small">Used for ' + (usePurposes.length ? usePurposes.map(purposeChip).join(' ') : unk('unknown')) + '</p>' +
      '<p class="small dim">Detected ' + (ev ? esc(P.hdate(ev.t.slice(0, 10))) : esc(P.hdate(f.opened))) + ' by: ' + esc(f.detector) + '</p></div></div>' +
    '<p class="small"><b>What it means for a person:</b> ' + esc(f.human) + '</p>' +
    '<p class="small"><b>Checked at use by:</b> ' + (ctrl.length ? ctrl.map(function (c) { return chip(c) + ' ' + P.lvl(ent(c).level); }).join(' ') : unk('no control checks purpose here')) + '</p>' +
    '<h4 class="iv-h4">The promise it breaks</h4>' + promiseList(ps, 'no published promise covers this — the drift is invisible to the people affected') +
    (dec ? '<p class="small">Decision owed: ' + chip(dec, dec) + ' · owner ' + P.ownerHTML(ent(dec).owner) + '</p>' : '') +
    '<p class="small"><a href="#/chain?from=' + encodeURIComponent(ps[0] ? ps[0].id : f.id) + '">Follow the chain from promise to owner →</a></p>' +
    P.cite([f.id, ds].concat(fl.map(function (x) { return x.id; }), ps.map(function (p) { return p.id; })), 'Sources') + '</article>';
}
V['privacy/purpose'] = { title: 'Purpose', render: function () {
  var drifts = NS.findings.filter(function (f) { return /PURPOSE DRIFT/.test(f.kind) && isOpen(f); }).sort(function (a, b) { return (a.sev === 'HIGH' ? 0 : 1) - (b.sev === 'HIGH' ? 0 : 1) || b.people - a.people; });
  var personal = NS.datasets.filter(function (d) { return tierOf(d) >= 2; });
  var rows = personal.map(function (d) { var u = P.purposeUses(d); return { d: d, uses: u, bad: u.filter(function (x) { return x.verdict === 'drift' || x.verdict === 'added'; }), unk: u.filter(function (x) { return x.verdict === 'unknown'; }) }; });
  var drifting = rows.filter(function (r) { return r.bad.length; }), unknownUse = rows.filter(function (r) { return r.unk.length; });
  var broken = promisesOf(drifts.map(function (f) { return f.id; }));
  var table = '<div class="tbl-wrap iv-ptab"><table class="tbl iv-tbl"><caption class="sr-only">Purpose at collection versus purpose at use, per personal dataset</caption><thead><tr><th scope="col">Dataset</th><th scope="col">Collected for</th><th scope="col">Used for, beyond the collection</th><th scope="col">Also used, as collected</th><th scope="col">Checked at use?</th><th scope="col">Promises</th></tr></thead><tbody>' +
    rows.sort(function (a, b) { return b.bad.length - a.bad.length || b.unk.length - a.unk.length; }).map(function (r) {
      var d = r.d, byP = {};
      r.uses.forEach(function (u) { (byP[u.purpose] = byP[u.purpose] || []).push(u); });
      var added = d.purposes.filter(function (p) { return collectedFor(d).indexOf(p) < 0; });
      var verdictOf = function (p) { var us = byP[p]; return us.some(function (x) { return x.verdict === 'drift'; }) ? 'drift' : us[0].verdict; };
      var off = Object.keys(byP).filter(function (p) { return verdictOf(p) !== 'ok'; }), ok = Object.keys(byP).filter(function (p) { return verdictOf(p) === 'ok'; });
      return '<tr data-ds="' + d.id + '" class="' + (r.bad.length ? 'iv-rowbad' : '') + '"><th scope="row">' + chip(d.id) + '</th>' +
        '<td>' + (collectedFor(d).length ? esc(collectedFor(d).map(purposeLabel).join(', ')) : unk('none declared')) + (added.length ? '<div class="small bad">declared later: ' + esc(added.map(purposeLabel).join(', ')) + '</div>' : '') + '</td>' +
        '<td>' + (off.length ? '<ul class="iv-uses">' + off.map(function (p) {
          var v = verdictOf(p);
          return '<li class="iv-v-' + v + '">' + purposeChip(p) + ' <span class="small">' + esc(VERDICT[v]) + '</span><div class="small dim">' + uniq(byP[p].map(function (x) { return x.via; })).map(function (x) { return chip(x, typeOf(x) === 'flow' || typeOf(x) === 'finding' ? x : null); }).join(' ') + '</div></li>';
        }).join('') + '</ul>' : '<span class="ok small">none observed</span>') + '</td>' +
        '<td class="small">' + (ok.length ? ok.map(function (p) { return '<b>' + esc(purposeLabel(p)) + '</b> <span class="dim">— ' + esc(uniq(byP[p].map(function (x) { return x.text; })).join('; ')) + '</span>'; }).join('<br>') : '<span class="dim">no use observed</span>') + '</td>' +
        '<td class="small">' + purposeEnforcement(d) + '</td><td class="small">' + (promisesOf([d.id]).map(function (p) { return '<a class="mono" href="#/promises/' + p.id + '">' + p.id + '</a> ' + P.statusTag(P.promiseState(p).status); }).join('<br>') || '<span class="dim">none</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  return P.pageHead('Operate', 'Purpose at collection vs purpose at use', 'Data carries the purpose it was collected for. Purpose is checked when data is <b>used</b> — every flow, model and agent that reads it — not only when it is collected. A use that the collection never covered is drift, and it breaks the promise made at collection.') +
    '<p class="iv-answer"><b>' + drifting.length + ' of ' + personal.length + ' personal datasets</b> are used for a purpose they were not collected for; ' + pl(unknownUse.length, 'dataset') + ' ' + (unknownUse.length === 1 ? 'has' : 'have') + ' a use nobody can name. ' +
      '<b>' + pl(drifts.length, 'open purpose-drift finding') + '</b> ' + (drifts.length === 1 ? 'breaks' : 'break') + ' ' + pl(broken.length, 'published promise') + (broken.length ? ' (' + broken.map(function (p) { return p.id; }).join(', ') + ')' : '') + '.</p>' +
    P.cite(drifts.map(function (f) { return f.id; }).concat(drifting.map(function (r) { return r.d.id; })), 'Built from') +
    section('pp-drift', 'Drift detected at use time', '<div class="grid g2">' + drifts.map(driftCard).join('') + '</div>', 'One card per open purpose-drift finding: what the data was collected for, what it is used for now, how the change was detected, and the promise it breaks.') +
    section('pp-all', 'Every personal dataset: collected for, and used for', table + '<p class="small dim">Uses come from the lineage (every flow downstream of the dataset), the models trained on or retrieving it, AI agents with a tool on it, and open purpose-drift findings. Training on customer conversations counts as model training, whatever the model serves.</p>') +
    '<div class="callout iv-mt">Four questions for every new use: what did the person understand when they shared it; what purpose is recorded in metadata, not memory; if the purpose changed, what is the new basis; and can they revoke, and does that reach every copy? Enforcement today: ' + chip('c_purpose_runtime') + ' checks purpose at query time for Pulse only; elsewhere ' + chip('c_purpose_fs') + ' is a human approval.</div>';
}, mount: wire };

/* ═════════════ VENDORS & EGRESS · VENDOR REGISTER ═════════════ */
var JUR = { us: 'US', 'us-east': 'US', 'us-west': 'US', eu: 'EU', 'eu-west': 'EU', 'eu-central': 'EU', uk: 'UK', in: 'India', sg: 'Singapore', br: 'Brazil', jp: 'Japan' };
function jur(r) { return r === 'unknown' || r == null ? null : JUR[r] || null; }
function regionName(r) { return ENT[r] && typeOf(r) === 'region' ? P.name(r) : r === 'device' ? 'the person’s device' : JUR[r] || r; }
var HS = { NONE: 'none — receives the person', TOKEN: 'token', RELAY: 'relay', PERMISSION: 'permission', PROOF: 'proof', AGGREGATE: 'aggregate' };
function vendorFlows(v) { var ids = [v.id].concat(v.subprocessors); return NS.flows.filter(function (f) { return ids.indexOf(f.to) >= 0; }); }
/* Cross-border movement for one vendor: recorded transfers first, then any flow whose jurisdictions differ. */
function vendorBorders(v) {
  var fl = vendorFlows(v), out = [];
  fl.forEach(function (f) {
    var t = NS.transfers.filter(function (x) { return x.flow === f.id; });
    if (t.length) t.forEach(function (x) { out.push({ from: jur(x.from), to: jur(x.to), basis: x.basis, flow: f.id, reviewed: x.reviewed }); });
    else { var a = jur(f.regionFrom), b = jur(f.regionTo); if (f.regionFrom !== 'user' && f.regionFrom !== 'device' && (b == null || a !== b)) out.push({ from: a, to: b, basis: null, flow: f.id, reviewed: f.status === 'reviewed' }); }
  });
  return out;
}
P.vendorRow = function (v) {
  var ops = (NS.vendorOps || {})[v.id] || {}, iss = P.vendorIssues().filter(function (x) { return x.v.id === v.id; })[0].issues;
  var sps = v.subprocessors.map(ent).filter(Boolean);
  return { v: v, ops: ops, issues: iss, subs: sps, borders: vendorBorders(v), jur: jur(v.region), subJur: sps.map(function (s) { return jur(s.region); }), promises: promisesOf([v.id]), hs: NS.handshakes[v.id] };
};
var DEL_WORD = { verified: 'deletion verified', requested: 'deletion requested, not confirmed', unconfirmed: 'deletion API, completion not proven', none: 'no deletion mechanism', unknown: 'deletion status unknown' };
function delHTML(o) {
  var d = o.deletion || { state: 'unknown' };
  var w = DEL_WORD[d.state] || d.state, body = d.state === 'unknown' ? unk(w) : '<span class="' + (d.state === 'verified' ? 'ok' : 'bad') + '">' + esc(w) + '</span>';
  return body + (d.date ? ' <span class="small dim">' + esc(P.hdate(d.date)) + '</span>' : '') + (d.text ? '<div class="small dim">' + esc(d.text) + '</div>' : '');
}
function vendorTable(rows) {
  return '<div class="tbl-wrap iv-vtab"><table class="tbl iv-tbl vend-t"><caption class="sr-only">Every vendor: data shared, purpose, contract, retention, jurisdiction, cross-border movement, access, audit and deletion</caption><thead><tr>' +
    ['Vendor', 'Data shared', 'Purpose', 'Contract basis', 'Retention: contract / actual', 'Jurisdiction', 'Cross-border', 'Access method', 'Last audit', 'Status · deletion', 'Promises'].map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function (r) {
      var v = r.v, o = r.ops, rt = v.retention, over = rt.contract != null && rt.actual != null && rt.actual > rt.contract;
      var sj = uniq(r.subJur.map(function (x) { return x || 'unknown'; }));
      return '<tr data-vendor="' + v.id + '"><th scope="row">' + chip(v.id) + '<div class="small dim">' + esc(v.role) + '</div>' + (v.declared ? '' : '<span class="tag sev-HIGH">undeclared</span>') + '</th>' +
        '<td class="small"><span class="mono">' + esc(v.data.join(', ')) + '</span> ' + P.tier(v.tier) + '<div class="dim">' + (v.people ? fmtN(v.people) + ' people' : '') + '</div></td>' +
        '<td>' + purposeChip(v.purpose) + '</td>' +
        '<td class="small">' + (v.contract ? (v.contract.dpa ? 'DPA' : 'contract, no DPA') + ' · signed ' + esc(P.hdate(v.contract.signed)) + '<div class="' + (P.daysUntil(v.contract.expires) < 0 ? 'bad' : P.daysUntil(v.contract.expires) < 45 ? 'warn' : 'dim') + '">' + (P.daysUntil(v.contract.expires) < 0 ? 'expired ' : 'expires ') + esc(P.hdate(v.contract.expires)) + '</div>' + (v.contract.noTraining ? '<div class="dim">no-training clause</div>' : '') : unk('no contract on file')) + '</td>' +
        '<td class="small nowrap">' + (rt.contract == null ? unk('none') : esc(rt.contract === 0 ? 'none kept' : fmtDays(rt.contract))) + ' / ' + (rt.actual == null ? unk('unknown') : '<span class="' + (over ? 'bad' : '') + '">' + esc(rt.actual === 0 ? 'none kept' : fmtDays(rt.actual)) + '</span>') + (over ? '<div class="bad">kept longer than agreed</div>' : '') + '</td>' +
        '<td class="small c-jur">' + (r.jur ? esc(r.jur) : unk('unknown')) + (sj.length ? '<div class="dim">subprocessors: ' + sj.map(function (x) { return x === 'unknown' ? unk('unknown') : esc(x); }).join(', ') + '</div>' : '') + '</td>' +
        '<td class="small">' + (r.borders.length ? r.borders.map(function (b) { return (b.from ? esc(b.from) : unk('?')) + ' → ' + (b.to ? esc(b.to) : unk('unknown')) + ' <span class="dim">basis:</span> ' + (!b.basis || /unknown|none/.test(b.basis) ? unk(b.basis || 'none recorded') : esc(b.basis)); }).join('<br>') : '<span class="dim">none recorded</span>') + '</td>' +
        '<td class="small">' + (r.hs ? '<span class="tag ' + (r.hs === 'NONE' ? 'sev-HIGH' : 'sev-GOOD') + '">' + esc(HS[r.hs] || r.hs) + '</span>' : unk('no pattern named')) + (o.access ? '<div class="dim">' + esc(o.access) + '</div>' : '') + '</td>' +
        '<td class="small">' + (o.audit && o.audit.date ? esc(P.hdate(o.audit.date)) + '<div class="dim">' + esc(o.audit.kind) + (o.audit.result ? ' — ' + esc(o.audit.result) : '') + '</div>' : unk(o.audit ? o.audit.kind : 'never audited')) + '</td>' +
        '<td class="small c-del">' + (o.status ? '<div>' + esc(o.status) + '</div>' : '') + delHTML(o) + '</td>' +
        '<td class="small">' + (r.promises.length ? r.promises.map(function (p) { return '<a class="mono" href="#/promises/' + p.id + '">' + p.id + '</a> ' + P.statusTag(P.promiseState(p).status); }).join('<br>') : '<span class="dim">none</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
function subTable() {
  return '<div class="tbl-wrap"><table class="tbl iv-tbl"><caption class="sr-only">Subprocessors</caption><thead><tr><th scope="col">Subprocessor</th><th scope="col">Engaged by</th><th scope="col">Jurisdiction</th><th scope="col">Receives</th></tr></thead><tbody>' +
    NS.subprocessors.map(function (s) {
      var by = NS.vendors.filter(function (v) { return v.subprocessors.indexOf(s.id) >= 0; }), fl = NS.flows.filter(function (f) { return f.to === s.id; });
      return '<tr data-sub="' + s.id + '"><th scope="row">' + chip(s.id) + (s.known ? '' : ' <span class="tag k-UNKNOWN">not on any list</span>') + '</th><td>' + by.map(function (v) { return chip(v.id); }).join(' ') + '</td><td class="small">' + (jur(s.region) ? esc(jur(s.region)) : unk('unknown')) + '</td><td class="small">' + (fl.length ? fl.map(function (f) { return chip(f.id, f.id) + ' <span class="mono">' + esc(f.fields.join(', ')) + '</span>'; }).join('<br>') : unk('not known what it receives')) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
/* Egress: Northstar source → vendor → subprocessor, with arrowheads. */
function egressSVG() {
  var eg = NS.flows.filter(function (f) { return isVendorish(f.to); });
  var srcs = uniq(eg.filter(function (f) { return !isVendorish(f.from); }).map(function (f) { return f.from; }));
  var vs = NS.vendors.map(function (v) { return v.id; }), sps = NS.subprocessors.map(function (s) { return s.id; });
  var W = 1060, RH = 42, NW = 210, NH = 28, H = Math.max(srcs.length, vs.length, sps.length) * RH + 60, X = [16, 424, 832];
  function y(arr, id) { var off = (H - 40 - arr.length * RH) / 2; return 34 + off + arr.indexOf(id) * RH; }
  var s = '<svg class="iv-map" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Where personal data leaves Northstar: source systems to vendors to subprocessors"><defs>' + [['third', C.third], ['info', C.info], ['unknown', C.unknown], ['ok', C.ok]].map(function (m) { return marker('eg-' + m[0], m[1]); }).join('') + '</defs>';
  [['NORTHSTAR SOURCE', X[0]], ['VENDOR · PROCESSOR · PARTNER', X[1]], ['SUBPROCESSOR', X[2]]].forEach(function (c) { s += '<text x="' + c[1] + '" y="16" fill="' + C.dim + '" font-size="10" font-family="JetBrains Mono" letter-spacing="1">' + c[0] + '</text>'; });
  function curve(xa, ya, xb, yb) { var mx = (xa + xb) / 2; return 'M' + xa + ',' + ya + ' C' + mx + ',' + ya + ' ' + mx + ',' + yb + ' ' + xb + ',' + yb; }
  eg.forEach(function (f) {
    var fromV = isVendorish(f.from), xa = (fromV ? X[1] : X[0]) + NW, ya = (fromV ? y(vs, f.from) : y(srcs, f.from)) + NH / 2, xb = (fromV ? X[2] : X[1]) - 2, yb = (fromV ? y(sps, f.to) : y(vs, f.to)) + NH / 2;
    var k = f.status === 'unknown' ? 'unknown' : f.tier >= 3 ? 'third' : 'info';
    s += '<g class="edge" data-ent="' + f.id + '" tabindex="0" role="button" aria-label="' + esc('Flow ' + f.id + ': ' + P.name(f.from) + ' to ' + P.name(f.to) + (f.status === 'unknown' ? ', undescribed' : '')) + '"><path class="hit" d="' + curve(xa, ya, xb, yb) + '"/><path class="vis" d="' + curve(xa, ya, xb, yb) + '" fill="none" stroke="' + C[k] + '" stroke-width="' + (1 + f.tier * 0.5) + '"' + (k === 'unknown' ? ' stroke-dasharray="7 5"' : '') + ' marker-end="url(#eg-' + k + ')"/><title>' + esc(f.id + ': ' + f.fields.join(', ')) + '</title></g>';
  });
  NS.vendors.forEach(function (v) { v.subprocessors.forEach(function (sp) { if (eg.some(function (f) { return f.from === v.id && f.to === sp; })) return; var kn = ent(sp).known; s += '<path d="' + curve(X[1] + NW, y(vs, v.id) + NH / 2, X[2] - 2, y(sps, sp) + NH / 2) + '" fill="none" stroke="' + (kn ? C.ok : C.unknown) + '" stroke-width="1"' + (kn ? ' stroke-dasharray="1.5 4"' : ' stroke-dasharray="7 5"') + ' marker-end="url(#eg-' + (kn ? 'ok' : 'unknown') + ')"><title>' + esc(P.name(v.id) + ' engages ' + P.name(sp)) + '</title></path>'; }); });
  var iss = {}; P.vendorIssues().forEach(function (x) { iss[x.v.id] = x.issues; });
  function node(x, yy, id, sub, bad, unkn) { var nm = trunc(P.name(id), sub ? 22 : 30); return '<g class="node" data-ent="' + id + '" tabindex="0" role="button" aria-label="' + esc(P.name(id) + (sub ? ', ' + sub : '')) + '"><title>' + esc(P.name(id)) + '</title><rect x="' + x + '" y="' + yy + '" width="' + NW + '" height="' + NH + '" rx="7" fill="' + C.paper + '" stroke="' + (unkn ? C.unknown : bad ? C.third : C.line) + '"' + (unkn ? ' stroke-dasharray="4 3"' : '') + '/><text x="' + (x + 10) + '" y="' + (yy + 18) + '" fill="' + C.text + '" font-size="11.5">' + esc(nm) + '</text>' + (sub ? '<text x="' + (x + NW - 8) + '" y="' + (yy + 18) + '" fill="' + (bad ? C.third : C.dim) + '" font-size="9.5" text-anchor="end" font-family="JetBrains Mono">' + esc(sub) + '</text>' : '') + '</g>'; }
  srcs.forEach(function (id) { s += node(X[0], y(srcs, id), id, '', false, nodeUnknownish(id)); });
  NS.vendors.forEach(function (v) { var n = iss[v.id].length; s += node(X[1], y(vs, v.id), v.id, n ? pl(n, 'issue') : 'no issues', n > 1, !v.declared); });
  NS.subprocessors.forEach(function (sp) { s += node(X[2], y(sps, sp.id), sp.id, jur(sp.region) || 'unknown', false, !sp.known); });
  return s + '</svg>';
}
function egressLegend() {
  return '<div class="legend iv-legend"><span><i style="background:' + C.third + '"></i>sensitive data (tier 3 or 4)</span><span><i style="background:' + C.info + '"></i>personal data (tier 2)</span><span><i class="dash"></i>undescribed flow, or a party nobody can name</span><span><i class="iv-dotp"></i>engaged as subprocessor; no flow recorded</span><span class="dim">Line width = sensitivity tier. Dashed box = undeclared vendor or unknown owner.</span></div>';
}
function vendorsPage(mode) {
  var rows = NS.vendors.map(P.vendorRow).sort(function (a, b) { return b.issues.length - a.issues.length; });
  var und = rows.filter(function (r) { return !r.v.declared; }), over = rows.filter(function (r) { return r.v.retention.contract != null && r.v.retention.actual != null && r.v.retention.actual > r.v.retention.contract; });
  var nodel = rows.filter(function (r) { return !r.ops.deletion || ['none', 'unknown'].indexOf(r.ops.deletion.state) >= 0; });
  var xb = rows.filter(function (r) { return r.borders.some(function (b) { return !b.basis || /unknown|none/.test(b.basis); }); });
  var nocon = rows.filter(function (r) { return !r.v.contract || P.daysUntil(r.v.contract.expires) < 0; });
  var answer = '<p class="iv-answer"><b>' + pl(NS.vendors.length, 'vendor') + '</b> and ' + pl(NS.subprocessors.length, 'subprocessor') + ' receive Northstar data. ' +
    '<b class="bad">' + und.length + ' undeclared</b>, ' + nocon.length + ' with no current contract, ' + over.length + ' keeping data longer than agreed, ' + nodel.length + ' where deletion cannot be requested or confirmed, and ' + xb.length + ' moving data across borders with no recorded basis.</p>' +
    P.cite(und.concat(nocon, over, nodel, xb).map(function (r) { return r.v.id; }), 'Built from');
  var graph = '<div class="card iv-mapcard"><div class="card-h"><h2 class="sec">Where personal data leaves Northstar</h2><span class="sub">source → vendor → subprocessor</span></div>' + egressLegend() + scrollBox('Vendor egress map; scrolls sideways', egressSVG(), 'canvas iv-canvas') + '<p class="small dim">The register below is the same information as a table.</p></div>';
  var decide = '<div class="card iv-mt"><h2 class="sec">What needs a decision</h2><ul class="iv-list">' + rows.filter(function (r) { return r.issues.length; }).slice(0, 6).map(function (r) {
    return '<li>' + chip(r.v.id) + ' <span class="small">' + esc(r.issues.join(' · ')) + '</span>' + (r.promises.length ? ' <span class="small dim">— at stake:</span> ' + r.promises.map(function (p) { return '<a class="mono small" href="#/promises/' + p.id + '">' + p.id + '</a>'; }).join(' ') : '') + '</li>';
  }).join('') + '</ul></div>';
  var reg = section(mode === 'gov' ? 'vr-reg' : 'vr-reg2', 'Vendor register', vendorTable(rows), 'Shared fields, purpose, contract basis, retention (agreed and observed), jurisdiction, cross-border movement, how the vendor gets the data (the handshake pattern first), the last audit, and termination or deletion status.') +
    section(mode === 'gov' ? 'vr-sub' : 'vr-sub2', 'Subprocessors', subTable());
  if (mode === 'gov') return P.pageHead('Prove', 'Vendor register', 'For every partner, name the handshake pattern first — token, relay, proof, permission or aggregate — then the data, the retention and the contract. “None” means the partner receives the person. Unknowns are findings.') +
    answer + reg + decide + '<details class="iv-more iv-mt"><summary>Show the egress map</summary>' + graph + '</details>';
  return P.pageHead('Investigate', 'Vendors & egress', 'What leaves Northstar, to whom, on what terms, and whether it can be called back. Select any box or arrow for its record.') +
    answer + graph + reg + decide;
}
V['explore/vendors'] = { title: 'Vendors & egress', render: function () { return vendorsPage('explore'); }, mount: wire };
V['governance/vendors'] = { title: 'Vendor register', render: function () { return vendorsPage('gov'); }, mount: wire };

/* ═════════════ GEOGRAPHY ═════════════ */
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
var GEO_LBL = { 'us-east': [-12, 22, 'end'], 'us-west': [-8, -8, 'end'], 'eu-west': [-26, -18, 'end'], 'uk': [0, -24, 'middle'], 'eu-central': [28, 22, 'start'] };
function inPoly(x, y, poly) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; }
var DOTS = null;
function transferColour(t) { return t.to === 'unknown' || !t.basis || /unknown|none/.test(t.basis) ? 'unknown' : t.tier >= 3 && !t.reviewed ? 'third' : t.tier >= 3 ? 'drift' : 'ctl'; }
var TR_WORD = { unknown: 'no recorded basis, or destination unknown', third: 'sensitive, not reviewed', drift: 'sensitive, reviewed', ctl: 'aggregate or low tier' };
V['explore/geo'] = { title: 'Geography', render: function (s, q) {
  var W = 1000, H = 470, proj = function (lon, lat) { return [(lon + 180) / 360 * W, (78 - lat) / (78 + 58) * H]; };
  if (!DOTS) { DOTS = ''; for (var lat = 76; lat > -56; lat -= 2.6) for (var lon = -178; lon < 180; lon += 2.6) { for (var k = 0; k < LAND.length; k++) if (inPoly(lon, lat, LAND[k])) { var p = proj(lon, lat); DOTS += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="1.5"/>'; break; } } }
  var tf = ['all', 'sens', 'unrev', 'eu'].indexOf(q.t) >= 0 ? q.t : 'all';
  var tr = NS.transfers.filter(function (t) { return tf === 'all' || (tf === 'sens' && t.tier >= 3) || (tf === 'unrev' && !t.reviewed) || (tf === 'eu' && /^eu/.test(t.from) && !/^eu/.test(t.to)); });
  var RP = {}; NS.regions.forEach(function (r) { RP[r.id] = proj(r.lon, r.lat); });
  var svg = '<svg class="iv-geo" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="group" aria-label="World map of Northstar data regions and cross-border transfers; the table below lists every transfer"><defs>' + ['unknown', 'third', 'drift', 'ctl'].map(function (k) { return marker('gm-' + k, C[k]); }).join('') + '</defs><g fill="#d3cbbb" aria-hidden="true">' + DOTS + '</g>';
  NS.geoUsers.forEach(function (g) { var p = RP[g.region]; if (p) svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (6 + Math.sqrt(g.people / 1e6) * 2.2).toFixed(1) + '" fill="#1f6ac0" fill-opacity=".10" stroke="#1f6ac0" stroke-opacity=".3"><title>' + esc(fmtN(g.people) + ' people in ' + P.name(g.region)) + '</title></circle>'; });
  tr.forEach(function (t) {
    var a = RP[t.from], b = RP[t.to]; if (!a || !b) return;
    var mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - Math.abs(a[0] - b[0]) * 0.22 - 20, k = transferColour(t);
    var dd = 'M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' Q' + mx.toFixed(1) + ',' + my.toFixed(1) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1);
    var lab = P.name(t.from) + ' to ' + P.name(t.to) + ': ' + t.what + ' (basis: ' + t.basis + ')';
    svg += t.flow ? '<g class="edge" data-ent="' + t.flow + '" tabindex="0" role="button" aria-label="' + esc(lab) + '"><path class="hit" d="' + dd + '"/><path class="vis" d="' + dd + '" fill="none" stroke="' + C[k] + '" stroke-width="' + (1 + t.tier * 0.5) + '"' + (k === 'unknown' ? ' stroke-dasharray="7 5"' : '') + ' marker-end="url(#gm-' + k + ')"/><title>' + esc(lab) + '</title></g>'
      : '<path d="' + dd + '" fill="none" stroke="' + C[k] + '" stroke-width="' + (1 + t.tier * 0.5) + '"' + (k === 'unknown' ? ' stroke-dasharray="7 5"' : '') + ' marker-end="url(#gm-' + k + ')"><title>' + esc(lab) + '</title></path>';
  });
  NS.regions.forEach(function (r) {
    var p = RP[r.id], col = r.kind === 'store' ? C.ctl : r.kind === 'vendor' ? C.third : r.kind === 'unknown' ? C.unknown : r.kind === 'process' ? C.drift : C.info;
    var L = GEO_LBL[r.id] || [8, -6, 'start'], lx = p[0] + L[0], ly = p[1] + L[1], far = Math.abs(L[0]) > 12 || Math.abs(L[1]) > 12;
    svg += '<g class="node" data-ent="' + r.id + '" tabindex="0" role="button" aria-label="' + esc(r.label) + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="' + col + '"' + (r.kind === 'unknown' ? ' fill-opacity="0" stroke="' + C.unknown + '" stroke-dasharray="2 2"' : '') + '/>' +
      (far ? '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + lx + '" y2="' + (ly + (L[1] < 0 ? 3 : -10)) + '" stroke="#8a8272" stroke-width=".7"/>' : '') +
      '<text x="' + lx + '" y="' + ly + '" fill="#3a4250" font-size="10.5" text-anchor="' + L[2] + '" paint-order="stroke" stroke="#fffdf9" stroke-width="3" stroke-linejoin="round">' + esc(r.label.split(' — ')[0].split(' (')[0]) + '</text></g>';
  });
  svg += '</svg>';
  var noBasis = NS.transfers.filter(function (t) { return !t.basis || /unknown|none/.test(t.basis) || t.to === 'unknown'; });
  var sens = NS.transfers.filter(function (t) { return t.tier >= 3 && !t.reviewed; });
  var ps = promisesOf(NS.transfers.map(function (t) { return t.flow; }).filter(Boolean));
  var table = '<div class="tbl-wrap"><table class="tbl iv-tbl geo-t"><caption class="sr-only">Cross-border transfers</caption><thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">What</th><th scope="col">Tier</th><th scope="col">Transfer basis</th><th scope="col">Reviewed</th><th scope="col">Flow · promise</th></tr></thead><tbody>' +
    tr.map(function (t) { var pr = t.flow ? promisesOf([t.flow]) : []; return '<tr><td class="small">' + esc(P.name(t.from)) + '</td><td class="small">' + (t.to === 'unknown' ? unk('unknown destination') : esc(P.name(t.to))) + '</td><td>' + esc(t.what) + '</td><td>' + P.tier(t.tier) + '</td><td class="small">' + (/unknown|none/.test(t.basis) ? unk(t.basis) : esc(t.basis)) + '</td><td>' + (t.reviewed ? '<span class="ok">yes</span>' : '<span class="bad">no</span>') + '</td><td class="small">' + (t.flow ? chip(t.flow, t.flow) : unk('no flow recorded')) + ' ' + pr.map(function (p) { return '<a class="mono" href="#/promises/' + p.id + '">' + p.id + '</a>'; }).join(' ') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  var users = '<div class="tbl-wrap"><table class="tbl iv-tbl"><caption class="sr-only">Where Northstar’s users are</caption><thead><tr><th scope="col">Region</th><th scope="col" class="num">People</th><th scope="col">Data stored there</th></tr></thead><tbody>' +
    NS.geoUsers.slice().sort(function (a, b) { return b.people - a.people; }).map(function (g) { var ds = NS.datasets.filter(function (d) { return d.regions.indexOf(g.region) >= 0; }); return '<tr><td>' + esc(P.name(g.region)) + '</td><td class="num">' + fmtN(g.people) + '</td><td class="small">' + (ds.length ? pl(ds.length, 'dataset') : '<span class="dim">none — processed elsewhere</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  return P.pageHead('Investigate', 'Geography & data residency', 'Where people are, where their data is stored and processed, and where it crosses a border — with the legal basis for each crossing. Unknown destinations and missing bases are findings.') +
    '<p class="iv-answer"><b>' + pl(NS.transfers.length, 'cross-border transfer') + '</b> recorded; <b class="bad">' + noBasis.length + ' have no recorded basis or an unknown destination</b>, and ' + sens.length + ' carry sensitive data without a review.</p>' + P.cite(noBasis.map(function (t) { return t.flow; }).filter(Boolean), 'Built from') +
    '<div class="toolbar"><div class="seg" role="group" aria-label="Filter transfers">' + [['all', 'All transfers'], ['sens', 'Sensitive (T3+)'], ['unrev', 'Unreviewed'], ['eu', 'Leaves Europe']].map(function (x) { return '<button data-go="explore/geo?t=' + x[0] + '" aria-pressed="' + (tf === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="card iv-mapcard"><div class="legend iv-legend"><span><i style="background:' + C.unknown + '"></i>' + esc(TR_WORD.unknown) + '</span><span><i style="background:' + C.third + '"></i>' + esc(TR_WORD.third) + '</span><span><i style="background:' + C.drift + '"></i>' + esc(TR_WORD.drift) + '</span><span><i style="background:' + C.ctl + '"></i>' + esc(TR_WORD.ctl) + '</span><span class="iv-halo">blue halo = where users are (size ≈ people)</span><span class="dim">Dots: teal store · amber processing · coral vendor · violet ring unknown.</span></div>' +
      scrollBox('Data residency map; scrolls sideways', svg, 'iv-geo-box') + '</div>' +
    section('geo-tr', 'Every transfer shown on the map', table) +
    '<div class="grid g2 iv-mt"><div class="card"><h3 class="iv-h3">Where people are</h3>' + users + '</div><div class="card"><h3 class="iv-h3">Promises that depend on residency</h3>' + promiseList(ps) + '</div></div>' +
    '<p class="small dim">The map is schematic. Transfer bases are illustrative and not legal advice.</p>';
}, mount: wire };

/* ═════════════ AI & AGENTS ═════════════ */
var ST_COL = { training: C.info, fineTune: C.third, rag: C.drift, vector: C.drift, memory: C.mem };
var ST_DASH = { training: '', fineTune: '', rag: '7 4', vector: '7 4', memory: '2 4' };
function aiLinks() {
  var out = [];
  NS.models.forEach(function (m) { var s = P.aiSources(m); STAGES.forEach(function (st) { s[st[0]].forEach(function (d) { out.push({ m: m, ds: d, stage: st[0], label: st[1] }); }); }); });
  return out;
}
function aiLineageSVG(links) {
  var dss = uniq(links.map(function (l) { return l.ds; })).sort(function (a, b) { return (CONVO.indexOf(b) >= 0) - (CONVO.indexOf(a) >= 0); });
  var ms = NS.models.map(function (m) { return m.id; }), hosts = ['ON DEVICE', 'ISOLATED PRIVATE CLOUD', 'INTERNAL CLOUD', 'THIRD-PARTY MODEL'];
  var RH = 44, NW = 200, NH = 30, X = [14, 400, 786], W = X[2] + NW + 14, H = Math.max(dss.length, ms.length) * RH + 60;
  function y(arr, id) { var off = (H - 40 - arr.length * RH) / 2; return 34 + off + arr.indexOf(id) * RH; }
  var s = '<svg class="iv-map" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Which datasets feed which AI models, and where each model runs; the table below lists every link"><defs>' + Object.keys(ST_COL).map(function (k) { return marker('ai-' + k, ST_COL[k]); }).join('') + marker('ai-host', C.ok) + '</defs>';
  [['DATA', X[0]], ['MODEL', X[1]], ['WHERE IT RUNS', X[2]]].forEach(function (c) { s += '<text x="' + c[1] + '" y="16" fill="' + C.dim + '" font-size="10" font-family="JetBrains Mono" letter-spacing="1">' + c[0] + '</text>'; });
  function curve(xa, ya, xb, yb) { var mx = (xa + xb) / 2; return 'M' + xa + ',' + ya + ' C' + mx + ',' + ya + ' ' + mx + ',' + yb + ' ' + xb + ',' + yb; }
  links.forEach(function (l, i) { var dy = (i % 3 - 1) * 4; s += '<path d="' + curve(X[0] + NW, y(dss, l.ds) + NH / 2 + dy, X[1] - 2, y(ms, l.m.id) + NH / 2) + '" fill="none" stroke="' + ST_COL[l.stage] + '" stroke-width="' + (l.stage === 'fineTune' ? 2.6 : 1.8) + '"' + (ST_DASH[l.stage] ? ' stroke-dasharray="' + ST_DASH[l.stage] + '"' : '') + ' marker-end="url(#ai-' + l.stage + ')"><title>' + esc(P.name(l.ds) + ' → ' + l.m.name + ' (' + l.label + ')') + '</title></path>'; });
  var hy = function (h) { var off = (H - 40 - hosts.length * RH * 1.6) / 2; return 34 + off + hosts.indexOf(h) * RH * 1.6; };
  NS.models.forEach(function (m) { var h = hostingOf(m); s += '<path d="' + curve(X[1] + NW, y(ms, m.id) + NH / 2, X[2] - 2, hy(h) + NH / 2) + '" fill="none" stroke="' + C.ok + '" stroke-width="1.2" marker-end="url(#ai-host)"><title>' + esc(m.name + ' runs: ' + HOST_TEXT[h]) + '</title></path>'; });
  dss.forEach(function (d) { var cv = CONVO.indexOf(d) >= 0, yy = y(dss, d); s += '<g class="node" data-ent="' + d + '" tabindex="0" role="button" aria-label="' + esc(P.name(d) + (cv ? ', holds customer conversations' : '')) + '"><title>' + esc(P.name(d)) + '</title><rect x="' + X[0] + '" y="' + yy + '" width="' + NW + '" height="' + NH + '" rx="7" fill="' + C.paper + '" stroke="' + (cv ? C.third : C.line) + '" stroke-width="' + (cv ? 1.6 : 1) + '"/><text x="' + (X[0] + 10) + '" y="' + (yy + 19) + '" fill="' + C.text + '" font-size="11.5">' + esc(trunc(P.name(d), 28)) + '</text></g>'; });
  ms.forEach(function (id) { var m = ent(id), cv = P.aiHoldsConversations(m).length, yy = y(ms, id); s += '<g class="node" data-ent="' + id + '" tabindex="0" role="button" aria-label="' + esc(m.name) + '"><title>' + esc(m.name) + '</title><rect x="' + X[1] + '" y="' + yy + '" width="' + NW + '" height="' + NH + '" rx="7" fill="' + C.paper + '" stroke="' + (cv ? C.third : C.line) + '"/><rect x="' + X[1] + '" y="' + yy + '" width="4" height="' + NH + '" rx="2" fill="' + C.mem + '"/><text x="' + (X[1] + 12) + '" y="' + (yy + 19) + '" fill="' + C.text + '" font-size="11.5">' + esc(trunc(m.name, 28)) + '</text></g>'; });
  hosts.forEach(function (h) { var yy = hy(h); s += '<g><rect x="' + X[2] + '" y="' + yy + '" width="' + NW + '" height="' + NH + '" rx="7" fill="' + C.paper + '" stroke="' + (h === 'THIRD-PARTY MODEL' ? C.third : h === 'ON DEVICE' ? C.ctl : C.line) + '"/><text x="' + (X[2] + 10) + '" y="' + (yy + 19) + '" fill="' + C.text + '" font-size="11.5">' + esc(HOST_TEXT[h]) + '</text></g>'; });
  return s + '</svg>';
}
function aiLegend() {
  return '<div class="legend iv-legend">' + [['training', 'training'], ['fineTune', 'fine-tuning (learns from it; hardest to undo)'], ['rag', 'retrieval / vector store (looked up at answer time)'], ['memory', 'memory (written about the person)']].map(function (x) {
    return '<span><i style="background:' + (ST_DASH[x[0]] ? 'repeating-linear-gradient(90deg,' + ST_COL[x[0]] + ' 0 5px,transparent 5px 8px)' : ST_COL[x[0]]) + '"></i>' + esc(x[1]) + '</span>';
  }).join('') + '<span><i class="iv-convo-k"></i>holds customer conversations</span></div>';
}
function aiLinkTable(links) {
  return '<div class="tbl-wrap"><table class="tbl iv-tbl ai-links"><caption class="sr-only">Every link from a dataset to an AI model</caption><thead><tr><th scope="col">Data</th><th scope="col">Model</th><th scope="col">How it is used</th><th scope="col">Customer conversations?</th><th scope="col">Consent at collection</th><th scope="col">Can it be taken back out?</th></tr></thead><tbody>' +
    links.map(function (l) {
      var d = ent(l.ds), cv = CONVO.indexOf(l.ds) >= 0, x = NS.aiModels[l.m.id] || {}, o = NS.origins[l.ds];
      var back = l.stage === 'rag' || l.stage === 'vector' ? 'Delete the chunk; retrieval stops' + (d.deletionVerified ? '' : ' — not verified') : l.stage === 'memory' ? 'Delete the row' : x.retrain && x.retrain.excludesDeleted ? 'At the next retrain' : x.retrain ? '<span class="bad">Only by retraining from a cleaned set</span>' : unk('unknown');
      return '<tr data-model="' + l.m.id + '" data-ds="' + l.ds + '" data-stage="' + l.stage + '"><td>' + chip(l.ds) + '</td><td>' + chip(l.m.id) + '</td><td>' + esc(l.label) + '</td><td>' + (cv ? '<span class="tag sev-HIGH">yes</span>' : '<span class="dim">no</span>') + '</td><td class="small">' + (o && o.basis ? esc(o.basis) : unk('none recorded')) + '</td><td class="small">' + back + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
function nextRetrain(x) { if (!x || !x.retrain || !x.retrain.last) return null; var t = new Date(x.retrain.last + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + x.retrain.cadence); return t.toISOString().slice(0, 10); }
var EXTRACT = { high: 'High', medium: 'Medium', low: 'Low' };
function sourceExposure(m) {
  var ds = P.aiAllSources(m).map(ent).filter(Boolean), fields = [];
  ds.forEach(function (d) { d.fields.forEach(function (f) { if (f[1] >= 3) fields.push([f[0], f[1]]); }); });
  var top = fields.reduce(function (a, f) { return Math.max(a, f[1]); }, 0);
  return { top: top, t4: uniq(fields.filter(function (f) { return f[1] === 4; }).map(function (f) { return f[0]; })), t3: uniq(fields.filter(function (f) { return f[1] === 3; }).map(function (f) { return f[0]; })) };
}
function artefactRow(k, a) { return '<tr><th scope="row">' + esc(k) + '</th><td>' + (a ? esc(a.what) : '<span class="dim">none kept</span>') + '</td><td>' + (a ? (a.retention ? esc(a.retention) : unk('retention not defined')) : '—') + '</td></tr>'; }
function modelCard(m) {
  var x = NS.aiModels[m.id] || {}, s = P.aiSources(m), cv = P.aiHoldsConversations(m), h = hostingOf(m), ex = sourceExposure(m);
  var f = P.findingsFor(m.id), ps = promisesOf([m.id].concat(cv)), ags = (NS.agents || []).filter(function (a) { return a.model === m.id || a.tools.some(function (t) { return t.system === m.id; }); });
  var nr = nextRetrain(x), rt = x.retrain;
  var reach = !s.training.length && !s.fineTune.length ? '<span class="ok">nothing to unlearn — it does not train on this data</span>' : !rt ? unk('unknown — no retraining schedule on record') : !rt.excludesDeleted ? '<b class="bad">Never, unless the training set is rebuilt without them</b>' : '<b>' + esc(P.hdate(nr)) + '</b> <span class="small dim">(next retrain; last ' + esc(P.hdate(rt.last)) + ')</span>';
  var third = m.thirdParty.filter(function (v) { return ENT[v]; }), borders = [];
  third.forEach(function (v) { if (typeOf(v) === 'vendor') vendorBorders(ent(v)).forEach(function (b) { borders.push(b); }); });
  var stageRow = function (k, lab) { return '<div><dt>' + lab + '</dt><dd>' + (s[k].length ? s[k].map(function (d) { return chip(d); }).join(' ') : '<span class="dim">—</span>') + '</dd></div>'; };
  var exLv = x.extraction ? x.extraction.level : null;
  var arts = [['Prompts', 'prompts'], ['Outputs', 'outputs'], ['Logs', 'logs'], ['Embeddings', 'embeddings'], ['Memory', 'memory']].map(function (k) { return [k[0], k[1], (x.artefacts || {})[k[1]]]; }).filter(function (k) { return k[2]; });
  return '<article class="card iv-model" data-model="' + m.id + '" aria-labelledby="mdl-' + m.id + '">' +
    '<div class="card-h"><div><h3 class="iv-h3" id="mdl-' + m.id + '">' + chip(m.id, m.name) + '</h3><p class="small dim">' + esc(m.provider) + ' · ' + esc(HOST_TEXT[h]) + ' · owner ' + P.ownerHTML(m.team) + ' · serves ' + purposeChip(m.purpose) + '</p></div>' +
      '<span class="iv-convo ' + (cv.length ? 'yes' : 'no') + '">' + (cv.length ? 'Holds customer conversations' : 'No customer conversations') + '</span></div>' +
    (h !== m.hosting ? '<p class="callout unk small">' + unk('Hosting record disagrees') + ' Recorded as ' + esc(m.hosting.toLowerCase()) + ', but it runs on ' + esc(m.provider) + '.</p>' : '') +
    '<dl class="iv-stages">' + stageRow('training', 'Training') + stageRow('fineTune', 'Fine-tuning') + stageRow('rag', 'Retrieval') + stageRow('vector', 'Vector store') + stageRow('memory', 'Memory') +
      '<div class="wide"><dt>At inference</dt><dd class="small">' + (x.inference ? esc(x.inference) : unk('not recorded')) + '</dd></div></dl>' +
    '<div class="iv-mfacts">' +
      '<div><div class="ai-exp"><h4 class="iv-h4">Sensitive data it can see</h4><p class="small">' + (ex.top ? P.tier(ex.top) + ' ' + (ex.t4.length ? '<b>special category:</b> <span class="mono">' + esc(ex.t4.join(', ')) + '</span> ' : '') + (ex.t3.length ? '<span class="dim">sensitive:</span> <span class="mono">' + esc(ex.t3.join(', ')) + '</span>' : '') : '<span class="dim">no tier 3 or 4 fields in its sources</span>') + '</p></div>' +
      '<div class="ai-consent"><h4 class="iv-h4">Purpose and consent</h4><p class="small">Consent: ' + (/unknown|n\/a/.test(m.consent) ? unk(m.consent) : esc(m.consent)) + '. ' + (cv.length && (s.training.concat(s.fineTune)).some(function (d) { return CONVO.indexOf(d) >= 0; }) ? '<span class="bad">Learns from customer conversations without a separate opt-in.</span>' : '') + '</p></div></div>' +
      '<div><div class="ai-ret"><h4 class="iv-h4">Retention</h4><p class="small">Training data kept: ' + (/unknown/.test(m.trainingRetention) ? unk('unknown') : esc(m.trainingRetention)) + '</p><p class="small">' + (arts.length ? arts.map(function (a) { return esc(a[0]) + ': ' + (a[2].retention ? esc(a[2].retention) : unk('not defined')); }).join(' · ') : '<span class="dim">Nothing else is kept.</span>') + '</p></div>' +
      '<div class="ai-unlearn"><h4 class="iv-h4">Deletion and unlearning</h4><p class="small">Deletion path: ' + (/unknown/.test(m.deletionPath) ? unk('unknown') : /^none/.test(m.deletionPath) ? '<span class="bad">' + esc(m.deletionPath) + '</span>' : esc(m.deletionPath)) + '</p>' +
        '<p class="small">' + (x.unlearning ? esc(x.unlearning) : unk('unlearning limits not recorded')) + '</p><p class="small">A deleted person leaves the model: ' + reach + '</p></div></div>' +
      '<div><div class="ai-extract"><h4 class="iv-h4">Memorisation and extraction risk</h4><p class="small">' + (exLv ? '<span class="rx-band rx-' + exLv + '">' + EXTRACT[exLv] + '</span> ' : unk('unknown') + ' ') + esc(x.extraction ? x.extraction.why : '') + ' <span class="dim">Last tested: ' + (x.extraction && x.extraction.tested ? esc(P.hdate(x.extraction.tested)) : 'never') + '.</span></p></div>' +
      '<div class="ai-adm-s"><h4 class="iv-h4">Automated decisions about people</h4><p class="small">' + (x.adm ? esc(x.adm.decides) + '. <span class="dim">Appeal:</span> ' + esc(x.adm.appeal) + '.' : '<span class="dim">None: it suggests or answers; people decide.</span>') + '</p></div></div>' +
    '</div>' +
    '<details class="iv-more"><summary>What it keeps, how it explains decisions, where it runs, which agents use it</summary><div class="iv-mfacts">' +
      '<div class="ai-art"><h4 class="iv-h4">Artefacts kept</h4><table class="tbl iv-tbl iv-art"><caption class="sr-only">What ' + esc(m.name) + ' keeps</caption><thead><tr><th scope="col">Artefact</th><th scope="col">What</th><th scope="col">Kept for</th></tr></thead><tbody>' +
        [['Prompts', 'prompts'], ['Outputs', 'outputs'], ['Logs', 'logs'], ['Embeddings', 'embeddings'], ['Memory', 'memory']].map(function (a) { return artefactRow(a[0], (x.artefacts || {})[a[1]]); }).join('') + '</tbody></table></div>' +
      '<div class="ai-adm"><h4 class="iv-h4">Automated decisions: explanation and appeal</h4>' + (x.adm ? P.kv([['Decides', esc(x.adm.decides)], ['Human in the loop', esc(x.adm.human)], ['Explanation given', esc(x.adm.explanation)], ['Appeal', esc(x.adm.appeal)]]) : '<p class="small dim">None: it suggests or answers; people decide.</p>') + '</div>' +
      '<div><div class="ai-res"><h4 class="iv-h4">Vendor and residency</h4><p class="small">Runs in ' + esc(regionName(m.region)) + (third.length ? ' · third parties ' + third.map(function (v) { return chip(v); }).join(' ') : ' · no third party') + '</p>' +
        (borders.length ? '<p class="small">' + borders.map(function (b) { return (b.from ? esc(b.from) : unk('?')) + ' → ' + (b.to ? esc(b.to) : unk('unknown')) + ', basis ' + (!b.basis || /unknown|none/.test(b.basis) ? unk(b.basis || 'none recorded') : esc(b.basis)); }).join('<br>') + '</p>' : '') + '</div>' +
      '<div class="ai-agents"><h4 class="iv-h4">Agents that use it</h4>' + (ags.length ? '<ul class="iv-list">' + ags.map(function (a) { var act = a.tools.filter(function (t) { return t.kind === 'act' || t.kind === 'external'; }); return '<li>' + chip(a.id) + ' <span class="small">' + pl(a.tools.length, 'tool') + ', ' + act.length + ' that act or send data out; ' + act.filter(function (t) { return t.approval === 'none'; }).length + ' without human approval</span></li>'; }).join('') + '</ul>' : '<p class="small dim">No agent runs on this model.</p>') + '</div></div>' +
    '</div></details>' +
    '<div class="iv-foot"><p class="small">Review: ' + esc(m.review) + ' · provenance ' + (m.provenance === 'documented' ? '<span class="ok">documented</span>' : m.provenance === 'unknown' ? unk('unknown') : '<span class="warn">' + esc(m.provenance) + '</span>') + '</p>' +
      (f.length ? '<p class="small">Findings: ' + f.map(function (z) { return chip(z.id, z.id); }).join(' ') + '</p>' : '') +
      (ps.length ? '<p class="small">Promises: ' + ps.map(function (p) { return '<a class="mono" href="#/promises/' + p.id + '">' + p.id + '</a> ' + P.statusTag(P.promiseState(p).status); }).join(' ') + '</p>' : '') +
      P.cite([m.id].concat(P.aiAllSources(m), third), 'Sources') + '</div></article>';
}
var KIND_WORD = { read: 'reads', write: 'writes', act: 'acts on the person', external: 'sends data out' };
var APPR_WORD = { none: 'no human approval', 'human above a limit': 'a person approves above a limit', 'human before': 'a person approves first', blocked: 'blocked — always a person' };
function agentCard(a) {
  var act = a.tools.filter(function (t) { return t.kind === 'act' || t.kind === 'external'; }), free = act.filter(function (t) { return t.approval === 'none'; });
  var ps = promisesOf([a.model].concat(a.findings)), inj = a.injection || {};
  return '<article class="card iv-agent" data-agent="' + a.id + '" aria-labelledby="ag-' + a.id + '"><div class="card-h"><div><h3 class="iv-h3" id="ag-' + a.id + '">' + chip(a.id, a.name) + '</h3><p class="small dim">' + esc(a.status) + ' · since ' + esc(P.hdate(a.since)) + ' · acts for ' + esc(a.actsFor.toLowerCase()) + '</p></div><span class="tag">runs on ' + esc(P.name(a.model)) + '</span></div>' +
    '<p class="small"><b>' + pl(a.tools.length, 'tool') + '</b>; ' + act.length + ' act on a person or send data out, and <b class="' + (free.length ? 'bad' : 'ok') + '">' + free.length + ' of those need no human approval</b>.</p>' +
    '<div class="tbl-wrap"><table class="tbl iv-tbl ag-tools"><caption class="sr-only">Tools and permissions of ' + esc(a.name) + '</caption><thead><tr><th scope="col">Tool</th><th scope="col">What it does</th><th scope="col">Data</th><th scope="col">Scope</th><th scope="col">Human approval</th><th scope="col">Logged</th></tr></thead><tbody>' +
      a.tools.map(function (t) { return '<tr><th scope="row">' + esc(t.name) + '</th><td class="small">' + esc(KIND_WORD[t.kind]) + '</td><td>' + (t.data.length ? t.data.map(function (d) { return chip(d); }).join(' ') : '<span class="dim small">none</span>') + (ENT[t.system] ? '<div class="small dim">via ' + esc(P.name(t.system)) + '</div>' : '') + '</td><td class="small">' + esc(t.scope) + '</td>' +
        '<td class="small"><span class="' + (t.approval === 'none' && (t.kind === 'act' || t.kind === 'external') ? 'bad' : t.approval === 'none' ? '' : 'ok') + '">' + esc(APPR_WORD[t.approval] || t.approval) + '</span>' + (t.limit ? '<div class="dim">' + esc(t.limit) + '</div>' : '') + '</td><td class="small">' + (t.logged ? 'yes' : '<span class="bad">no</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<div class="grid g2 iv-mt"><div><h4 class="iv-h4">Human approval boundaries</h4><ul class="iv-list small">' + a.boundaries.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' +
      '<h4 class="iv-h4">Prompt injection</h4><p class="small">' + esc(inj.defence || '') + '. Last test: ' + (inj.lastTest ? esc(P.hdate(inj.lastTest)) + ' — ' + esc(inj.result) : unk('never tested')) + '</p>' +
      '<h4 class="iv-h4">Action log</h4><p class="small">' + chip(a.actionLog.where) + ' · kept ' + esc(a.actionLog.retention) + '</p></div>' +
      '<div><h4 class="iv-h4">Decisions it makes about people</h4>' + P.kv([['Decides', esc(a.adm.decides)], ['Explanation', esc(a.adm.explanation)], ['Appeal', esc(a.adm.appeal)]]) +
      '<h4 class="iv-h4">What we don’t know</h4>' + (a.unknowns.length ? '<ul class="iv-list small">' + a.unknowns.map(function (u) { return '<li>' + unk(u) + '</li>'; }).join('') + '</ul>' : '<p class="small dim">Nothing material.</p>') +
      '<p class="small">Privacy review: ' + (a.review ? esc(P.hdate(a.review)) : unk('never reviewed')) + '</p></div></div>' +
    '<p class="small">' + (a.findings.length ? 'Findings: ' + a.findings.map(function (z) { return chip(z, z); }).join(' ') + ' · ' : '') + (ps.length ? 'Promises: ' + ps.map(function (p) { return '<a class="mono" href="#/promises/' + p.id + '">' + p.id + '</a> ' + P.statusTag(P.promiseState(p).status); }).join(' ') : '') + '</p>' +
    P.cite([a.id, a.model].concat(a.findings, uniq([].concat.apply([], a.tools.map(function (t) { return t.data; })))), 'Sources') + '</article>';
}
var AI8 = [['Purpose', 'Collected to run a feature; now useful to train a model.'], ['Deletion', 'You can delete a row; not easily what a model learned from it.'], ['Consent', 'Permission to post was never permission to train.'], ['Inference', 'Models guess what you never shared.'], ['Context', 'A helpful assistant needs mail, messages and calendar in one place.'], ['Boundaries', 'Permissions were per app; an agent acts across all of them.'], ['Input = command', 'A page or email can carry instructions that make an agent leak.'], ['Retention', 'Prompts are records.']];
V['privacy/ai'] = { title: 'AI & agents', render: function () {
  var links = aiLinks(), convo = NS.models.filter(function (m) { return P.aiHoldsConversations(m).length; });
  var noForget = NS.models.filter(function (m) { var x = NS.aiModels[m.id] || {}; return /unknown|^none/.test(m.deletionPath) || (x.retrain && !x.retrain.excludesDeleted); });
  var ags = NS.agents || [], free = [].concat.apply([], ags.map(function (a) { return a.tools.filter(function (t) { return (t.kind === 'act' || t.kind === 'external') && t.approval === 'none'; }); }));
  var personal = NS.models.filter(function (m) { return m.personal; });
  return P.pageHead('Operate', 'AI & agents', 'Every model and agent: what data it learned from, retrieves or remembers; what it keeps; whether it can forget; which tools it can use and where a person must approve. Customer conversations are traced from the chat to the model.') +
    '<p class="iv-answer"><b>' + pl(NS.models.length, 'model') + '</b> (' + personal.length + ' using personal data) and <b>' + pl(ags.length, 'agent') + '</b>. <b class="bad">' + convo.length + ' models hold customer conversations</b>: ' + convo.map(function (m) { return esc(m.name); }).join(', ') + '. ' +
      noForget.length + ' cannot reliably forget a deleted person. Agents have ' + pl(free.length, 'tool') + ' that act on people or send data out with no human approval.</p>' +
    P.cite(convo.map(function (m) { return m.id; }).concat(CONVO, ags.map(function (a) { return a.id; })), 'Built from') +
    '<nav class="iv-jump" aria-label="On this page"><a href="#ai-lin">Which data feeds which model</a><a href="#ai-mod">Models</a><a href="#ai-ag">Agents</a><a href="#ai-8">Why AI is different</a></nav>' +
    section('ai-lin', 'Which data feeds which model', '<div class="card iv-mapcard">' + aiLegend() + scrollBox('AI data lineage diagram; scrolls sideways', aiLineageSVG(links), 'canvas iv-canvas') + '<h3 class="iv-h3 iv-mt">The same links, as a table</h3>' + aiLinkTable(links) + '</div>',
      'Conversation data: ' + (NS.aiConversationData || []).map(function (x) { return chip(x.ds) + ' <span class="dim">' + esc(x.what.toLowerCase()) + '</span>'; }).join(' · ')) +
    section('ai-mod', 'Models', '<div class="iv-models">' + NS.models.map(modelCard).join('') + '</div>', 'Training, fine-tuning, retrieval and inference data; what is kept; how deletion reaches the model; memorisation risk; automated decisions; vendor and residency. Deleting source rows does not remove what a model learned from them: retraining without them is the only reliable removal.') +
    section('ai-ag', 'Agents: tools, permissions and approval boundaries', '<div class="iv-models">' + ags.map(agentCard).join('') + '</div>') +
    section('ai-8', 'Why AI breaks eight assumptions privacy was built on', '<div class="card"><ol class="iv-ai8">' + AI8.map(function (x) { return '<li><b>' + esc(x[0]) + '.</b> ' + esc(x[1]) + '</li>'; }).join('') + '</ol></div>');
}, mount: wire };
P.passports.agent = function (a) {
  var act = a.tools.filter(function (t) { return t.kind === 'act' || t.kind === 'external'; });
  return '<p class="pp-type">AI agent · ' + esc(a.status) + '</p><h2 class="pp-title">' + esc(a.name) + '</h2><p class="muted small" style="margin:0">Acts for ' + esc(a.actsFor.toLowerCase()) + ' · runs on ' + esc(P.name(a.model)) + '</p>' +
    P.kv([['Owner', P.ownerHTML(a.team)], ['Purpose', purposeChip(a.purpose)], ['Tools', a.tools.map(function (t) { return esc(t.name) + ' <span class="small dim">(' + esc(APPR_WORD[t.approval] || t.approval) + ')</span>'; }).join('<br>')],
      ['Acts or sends out', pl(act.length, 'tool') + ', ' + act.filter(function (t) { return t.approval === 'none'; }).length + ' without approval'], ['Appeal', esc(a.adm.appeal)], ['Privacy review', a.review ? esc(P.hdate(a.review)) : unk('never reviewed')]]) +
    '<div class="btn-row" style="margin-top:10px"><a class="btn" href="#/privacy/ai#ai-ag">Open in AI & agents</a></div>';
};

/* ═════════════ WORST DAY ═════════════ */
var LV = ['none', 'low', 'moderate', 'high'];
var BANDS = ['Contained', 'Limited', 'Serious', 'Severe', 'Critical'];
var BAND_TEXT = ['Little that could hurt anyone would be exposed.', 'Some people could be affected, with limited harm.', 'Many people, or sensitive details, would be exposed.', 'Sensitive, identifiable data about many people would be exposed.', 'Sensitive, identifiable, long-kept data about a very large group, already spread to other places.'];
var ID_LV = { 'GLOBAL DURABLE': 3, 'CROSS-APP': 2, 'PER-VENDOR': 1, 'PURPOSE-SCOPED': 1, 'ROTATING': 1, 'EPHEMERAL': 0 };
function custody(d) { var s = (d.keyOwner || '') + ' ' + (d.encryption || ''); return /unknown/i.test(d.keyOwner || '') ? 'unknown' : /per-user|\bdevices?\b/i.test(s) ? 'person' : /vault|separate|hsm/i.test(s) ? 'vault' : 'company'; }
/* Everything the simulation needs about one dataset, and what is true today. */
P.wdFacts = function (dsId) {
  var d = ent(dsId); if (!d) return null;
  var L = P.lineage(dsId), ids = P.dsIds(d), r = d.retention;
  var joins = NS.idJoins.filter(function (j) { return !j[4] && (ids.indexOf(j[0]) >= 0 || ids.indexOf(j[1]) >= 0); });
  var vend = L.vendors.slice(), internal = L.copies.filter(function (x) { return !isVendorish(x); });
  var subs = uniq([].concat.apply([], vend.filter(function (v) { return typeOf(v) === 'vendor'; }).map(function (v) { return ent(v).subprocessors; }))).filter(function (x) { return vend.indexOf(x) < 0; });
  var idl = ids.reduce(function (a, i) { return Math.max(a, ENT[i] ? (ID_LV[ENT[i].obj.cls] || 0) : 0); }, 0);
  var inferred = d.fields.filter(function (f) { return f[2] === 'inference'; });
  var ttlOK = !!r.ttl && (r.note != null || (r.required != null && (r.actual == null || r.actual <= r.required)));
  var today = { ttl: ttlOK, minimise: !inferred.length, tokenise: idl <= 1, keys: custody(d) === 'person', novendor: !vend.length, nojoin: !joins.length, jit: d.accessPeople != null && d.accessPeople <= 10 };
  var can = { ttl: r.required != null && r.required > 0 || ttlOK, minimise: !!inferred.length, tokenise: !!ids.length, keys: true, novendor: !!vend.length, nojoin: !!joins.length, jit: true };
  return { d: d, L: L, ids: ids, joins: joins, vendors: vend, subs: subs, internal: internal, idLevel: idl, inferred: inferred, custody: custody(d), today: today, can: can, w: (NS.worstDay || []).filter(function (x) { return x.ds === dsId; })[0] };
};
/* The blast radius, dimension by dimension, as levels and words. */
P.wdSim = function (F, sc, on) {
  var d = F.d, r = d.retention, dims = [], cap = null;
  var people = d.people, pl3 = people == null ? 3 : people === 0 ? 0 : people < 1e5 ? 1 : people < 1e7 ? 2 : 3;
  var fields = on.minimise ? d.fields.filter(function (f) { return f[2] !== 'inference'; }) : d.fields;
  var tier = fields.reduce(function (a, f) { return Math.max(a, f[1]); }, 0), sl = tier <= 1 ? 0 : tier - 1;
  var top = fields.filter(function (f) { return f[1] >= 3; }).map(function (f) { return f[0]; });
  var days, kl, keptWhy;
  if (F.today.ttl && !on.ttl) { kl = 3; keptWhy = 'the TTL has failed: records pile up until someone notices'; }
  else if (!F.today.ttl && on.ttl && r.required > 0) { days = r.required; keptWhy = 'the declared ' + fmtDays(days) + ' is enforced'; }
  else { days = r.actual != null ? r.actual : d.age; keptWhy = days == null ? null : r.note && days === 0 ? 'lives ' + r.note + ' (' + fmtDays(d.age) + ' so far)' : 'oldest record ' + fmtDays(days) + (r.required > 0 && days > r.required ? ', against a declared need of ' + fmtDays(r.required) : ''); if (r.note && days === 0) days = d.age; }
  if (kl == null) kl = days == null ? 3 : days <= 0 ? 0 : days <= 30 ? 1 : days <= 365 ? 2 : 3;
  /* tokenising caps identifiability at low; losing existing tokens makes it high */
  var il = on.tokenise ? Math.min(F.idLevel, 1) : F.today.tokenise ? 3 : F.idLevel;
  var jn = on.nojoin ? 0 : F.joins.length;
  var vn = on.novendor ? 0 : F.vendors.length, copies = F.internal.length + vn + jn;
  var spl = copies === 0 ? 0 : copies <= 2 ? 1 : copies <= 4 ? 2 : 3; if (vn && spl < 3) spl++;
  dims.push({ k: 'people', label: 'How many people', lv: pl3, why: people == null ? null : people === 0 ? 'nobody yet — not launched' : fmtN(people) + ' ' + (d.subjects || 'people').toLowerCase() });
  dims.push({ k: 'sens', label: 'How sensitive', lv: sl, why: 'tier ' + tier + (top.length ? ': ' + top.slice(0, 4).join(', ') : '') + (on.minimise && F.inferred.length ? ' (inferred fields dropped)' : '') });
  dims.push({ k: 'kept', label: 'How long it was kept', lv: kl, why: keptWhy });
  dims.push({ k: 'ident', label: 'How identifiable', lv: il, why: on.tokenise && !F.today.tokenise ? 'durable identifiers replaced by scoped tokens' : !on.tokenise && F.today.tokenise ? 'scoped tokens replaced by a durable identifier' : F.ids.length ? F.ids.map(P.name).join(', ') : 'no identifiers — aggregate only' });
  if (sc === 'insider') {
    var ap = d.accessPeople, al = on.jit ? Math.min(1, ap == null ? 1 : ap > 0 ? 1 : 0) : ap == null ? 3 : ap === 0 ? 0 : ap <= 20 ? 1 : ap <= 100 ? 2 : 3;
    dims.push({ k: 'access', label: 'Who could look', lv: al, why: on.jit ? 'only people with an open, expiring ticket' : ap == null ? null : fmtN(ap) + ' people can read it today' });
  } else if (sc === 'vendor') {
    var vr = F.vendors.filter(function (v) { return typeOf(v) === 'vendor'; }).map(function (v) { return ent(v).retention.actual; });
    var vmax = vr.some(function (x) { return x == null; }) || !vr.length && F.vendors.length ? null : Math.max.apply(null, [0].concat(vr));
    dims[2] = { k: 'kept', label: 'How long the vendor keeps it', lv: vn === 0 ? 0 : vmax == null ? 3 : vmax <= 30 ? 1 : vmax <= 365 ? 2 : 3, why: vn === 0 ? 'no vendor copy' : vmax == null ? null : 'up to ' + fmtDays(vmax) + ' at the vendor' };
    dims.push({ k: 'keys', label: 'Who holds the keys', lv: vn === 0 ? 0 : 3, why: vn === 0 ? 'no vendor copy' : 'the vendor can read what it received' });
  } else {
    var cu = on.keys ? 'person' : F.today.keys ? 'company' : F.custody;
    dims.push({ k: 'keys', label: 'Who holds the keys', lv: cu === 'person' ? 0 : cu === 'vault' ? 1 : 3, why: cu === 'person' ? 'each person’s own key: a copy is unreadable' : cu === 'vault' ? 'a separate key vault' : cu === 'unknown' ? null : 'company-held (' + d.keyOwner + ')' });
    if (cu === 'person') cap = 1;
  }
  dims.push({ k: 'spread', label: sc === 'vendor' ? 'How many vendors hold it' : 'How far it has spread', lv: sc === 'vendor' ? (vn === 0 ? 0 : Math.min(3, vn + F.subs.length)) : spl,
    why: sc === 'vendor' ? (vn ? F.vendors.map(P.name).concat(F.subs.map(P.name)).join(', ') : 'none') : [F.internal.length ? pl(F.internal.length, 'internal copy', 'internal copies') : '', vn ? pl(vn, 'vendor') : '', jn ? pl(jn, 'unsanctioned join') : ''].filter(Boolean).join(', ') || 'nowhere else' });
  var pts = dims.reduce(function (a, x) { return a + x.lv; }, 0);
  var rank = people === 0 || (sc === 'vendor' && vn === 0) ? 0 : pts <= 3 ? 0 : pts <= 7 ? 1 : pts <= 10 ? 2 : pts <= 13 ? 3 : 4;
  if (cap != null) rank = Math.min(rank, cap);
  return { dims: dims, points: pts, rank: rank, band: BANDS[rank], capped: cap != null, unknowns: dims.filter(function (x) { return x.why == null; }).map(function (x) { return x.label.toLowerCase(); }) };
};
function wdSentence(F, sc, R) {
  var s = (NS.worstDayScenarios || []).filter(function (x) { return x.id === sc; })[0], d = F.d;
  if (d.people === 0) return 'Nobody’s data would be exposed today: ' + d.name + ' holds no one yet. ' + unk('Retention and deletion are undefined, so this changes the day it launches.');
  if (sc === 'vendor' && R.dims.filter(function (x) { return x.k === 'spread'; })[0].lv === 0) return 'No vendor holds a copy of ' + d.name + ', so a vendor breach cannot reach it.';
  var by = function (k) { return R.dims.filter(function (x) { return x.k === k; })[0]; };
  var parts = R.dims.map(function (x) { return x.why == null ? x.label.toLowerCase() + ' is unknown — counted as the worst case' : x.why; });
  return R.band + ': ' + (s ? s.who : 'an attacker') + ' would reach ' + parts[0] + '; ' + parts.slice(1).join('; ') + '.' + (R.capped ? ' Per-person keys keep the copy unreadable, so the band is held at Limited.' : '');
}
function wdLadder(R, T) {
  var pos = function (x) { return Math.min(97, Math.max(3, x.points / 18 * 100)); };
  return '<div class="iv-ladder" role="img" aria-label="' + esc('Blast radius band: ' + R.band + (T ? '; today: ' + T.band : '')) + '"><ol>' + BANDS.map(function (b, i) { return '<li class="iv-b' + i + (i === R.rank ? ' on' : '') + '">' + b + '</li>'; }).join('') + '</ol>' +
    '<div class="iv-lad-track" aria-hidden="true"><span class="iv-lad-m now" style="left:' + pos(R).toFixed(1) + '%"></span>' + (T && T.points !== R.points ? '<span class="iv-lad-m was" style="left:' + pos(T).toFixed(1) + '%"></span>' : '') + '</div>' +
    '<p class="small dim iv-lad-k">▲ where this result sits' + (T && T.points !== R.points ? ' · △ today' : '') + '. Position within a band shows whether it is near the band above or below.</p></div>';
}
P.state.wd = P.state.wd || null;
var NOT_APPLY = {
  ttl: function (F) { return F.d.retention.note ? 'it lives ' + F.d.retention.note + '; no fixed period to enforce' : 'no declared retention to enforce — itself a finding'; },
  minimise: function () { return 'no inferred fields to drop'; }, tokenise: function () { return 'no identifiers'; },
  novendor: function () { return 'no vendor holds a copy'; }, nojoin: function () { return 'no unsanctioned joins'; } };
function wdState(q) {
  var ids = NS.datasets.filter(function (d) { return tierOf(d) >= 2; }).map(function (d) { return d.id; });
  var first = (NS.worstDay || []).map(function (w) { return w.ds; }).filter(function (x) { return ids.indexOf(x) >= 0; });
  var st = P.state.wd;
  var ds = q.ds && ids.indexOf(q.ds) >= 0 ? q.ds : st && st.ds || first[0] || ids[0];
  if (!st || st.ds !== ds) { var F = P.wdFacts(ds); st = P.state.wd = { ds: ds, sc: st ? st.sc : 'breach', on: JSON.parse(JSON.stringify(F.today)) }; }
  if (q.sc && (NS.worstDayScenarios || []).some(function (x) { return x.id === q.sc; })) st.sc = q.sc;
  return { st: st, ids: ids, first: first };
}
function wdResultHTML(F, st) {
  var R = P.wdSim(F, st.sc, st.on), T = P.wdSim(F, st.sc, F.today), changed = JSON.stringify(st.on) !== JSON.stringify(F.today);
  return '<div class="iv-wd-res" data-rank="' + R.rank + '" data-points="' + R.points + '" data-today-rank="' + T.rank + '">' +
    '<p class="iv-wd-band iv-b' + R.rank + '"><span class="iv-wd-bw">' + R.band + '</span>' + (changed ? ' <span class="small dim">today: ' + T.band + (R.rank < T.rank ? ' — your changes make it smaller' : R.rank > T.rank ? ' — your changes make it larger' : R.points < T.points ? ' — smaller within the same band' : R.points > T.points ? ' — larger within the same band' : ' — no change') + '</span>' : '') + '</p>' +
    '<p class="iv-wd-s">' + esc(wdSentence(F, st.sc, R)) + '</p>' + wdLadder(R, changed ? T : null) +
    '<div class="tbl-wrap"><table class="tbl iv-tbl iv-wd-t"><caption class="sr-only">Blast radius by dimension</caption><thead><tr><th scope="col">Dimension</th><th scope="col">Today</th><th scope="col">' + (changed ? 'With your changes' : 'Simulated') + '</th><th scope="col">Why</th></tr></thead><tbody>' +
      R.dims.map(function (x, i) { var t = T.dims[i]; return '<tr><th scope="row">' + esc(x.label) + '</th><td><span class="iv-lv iv-lv' + t.lv + '">' + LV[t.lv] + '</span></td><td><span class="iv-lv iv-lv' + x.lv + '">' + LV[x.lv] + '</span>' + (x.lv < t.lv ? ' <span class="ok small">↓</span>' : x.lv > t.lv ? ' <span class="bad small">↑</span>' : '') + '</td><td class="small">' + (x.why == null ? unk('unknown — counted as the worst case') : esc(x.why)) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    (R.unknowns.length ? '<p class="small">' + unk('Unknown inputs: ' + R.unknowns.join(', ')) + ' — each is treated as the worst case, so the true band may be lower.</p>' : '') + '</div>';
}
function wdBestHTML(F, st) {
  var base = P.wdSim(F, st.sc, st.on);
  var rows = (NS.worstDaySafeguards || []).filter(function (g) { return !st.on[g.id] && F.can[g.id]; }).map(function (g) {
    var on = JSON.parse(JSON.stringify(st.on)); on[g.id] = true; var R = P.wdSim(F, st.sc, on);
    return { g: g, R: R, moved: R.dims.filter(function (x, i) { return x.lv < base.dims[i].lv; }).map(function (x) { return x.label.toLowerCase(); }) };
  }).sort(function (a, b) { return a.R.rank - b.R.rank || a.R.points - b.R.points; });
  if (!rows.length) return '<p class="small ok">Every safeguard that applies here is already switched on.</p>';
  return '<div class="tbl-wrap"><table class="tbl iv-tbl iv-best"><caption class="sr-only">Band after adding one safeguard</caption><thead><tr><th scope="col">Add one safeguard</th><th scope="col">Band after</th><th scope="col">What gets smaller</th><th scope="col">Control</th></tr></thead><tbody>' +
    rows.map(function (x) { return '<tr><th scope="row">' + esc(x.g.label) + '<div class="small dim">' + esc(x.g.does) + '</div></th><td><span class="iv-bt iv-b' + x.R.rank + '">' + x.R.band + '</span>' + (x.R.rank < base.rank ? ' <span class="ok small">↓</span>' : '') + '</td><td class="small">' + (x.moved.length ? esc(x.moved.join(', ')) : '<span class="dim">nothing for this scenario</span>') + '</td><td>' + chip(x.g.control) + '</td></tr>'; }).join('') + '</tbody></table></div>';
}
V['privacy/worstday'] = { title: 'Worst Day', render: function (s, q) {
  var W = wdState(q), st = W.st, F = P.wdFacts(st.ds), d = F.d;
  P.pushTrail(d.id);
  var others = W.ids.filter(function (x) { return W.first.indexOf(x) < 0; });
  var pick = '<label for="wdDs">If this were compromised today</label><select id="wdDs">' + '<optgroup label="Most at stake">' + W.first.map(function (id) { return '<option value="' + id + '"' + (id === st.ds ? ' selected' : '') + '>' + esc(P.name(id) + ' — ' + P.name(ent(id).system)) + '</option>'; }).join('') + '</optgroup><optgroup label="Other personal data">' + others.map(function (id) { return '<option value="' + id + '"' + (id === st.ds ? ' selected' : '') + '>' + esc(P.name(id) + ' — ' + P.name(ent(id).system)) + '</option>'; }).join('') + '</optgroup></select>';
  var scen = '<fieldset class="iv-fs"><legend>What goes wrong</legend>' + (NS.worstDayScenarios || []).map(function (x) { return '<label class="iv-radio"><input type="radio" name="wdSc" value="' + x.id + '"' + (x.id === st.sc ? ' checked' : '') + '> ' + esc(x.label) + '</label>'; }).join('') + '</fieldset>';
  var guards = '<fieldset class="iv-fs"><legend>Safeguards — switch one off to simulate a control failure, or on to see what it would buy</legend>' + (NS.worstDaySafeguards || []).map(function (g) {
    var t = F.today[g.id], can = F.can[g.id];
    return '<label class="iv-check' + (can ? '' : ' off') + '"><input type="checkbox" data-wd="' + g.id + '"' + (st.on[g.id] ? ' checked' : '') + (can ? '' : ' disabled') + '> <span>' + esc(g.label) + ' <span class="small ' + (t ? 'ok' : 'dim') + '">' + (can ? (t ? '· in place today' : '· not in place today') : '· ' + (NOT_APPLY[g.id] ? NOT_APPLY[g.id](F) : 'does not apply here')) + '</span></span></label>';
  }).join('') + '<button type="button" class="btn ghost" id="wdReset">Back to today</button></fieldset>';
  var infer = F.w ? F.w.infer : d.fields.filter(function (f) { return f[2] === 'inference'; }).map(function (f) { return f[0].replace(/_/g, ' '); });
  var ps = promisesOf([d.id]), risk = NS.risks.filter(function (r) { return r.asset === d.id; })[0];
  return P.pageHead('Decide', 'Worst Day', 'You can’t promise zero. You can decide, before it happens, how far a failure could reach. Pick the data and what goes wrong; switch safeguards on or off. The blast radius follows from what was collected, how long it was kept, how identifiable it is, who holds the keys and which vendors received it — in bands and words, never a score.') +
    '<div class="iv-wd"><form class="card iv-wd-form" onsubmit="return false" aria-label="Worst Day simulation">' + '<div class="iv-pick">' + pick + '</div>' + scen + guards + '</form>' +
      '<section class="card iv-wd-out" aria-labelledby="wdH"><h2 id="wdH" class="sec">Blast radius · ' + esc(d.name) + '</h2><div id="wdOut" aria-live="polite">' + wdResultHTML(F, st) + '</div></section></div>' +
    '<div class="grid g2 iv-mt"><div class="card"><h3 class="iv-h3">Which single change buys the most</h3><div id="wdBest">' + wdBestHTML(F, st) + '</div></div>' +
      '<div class="card"><h3 class="iv-h3">What someone could learn from it</h3>' + (infer.length ? '<ul class="iv-list">' + infer.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="small dim">No inference recorded beyond the fields themselves.</p>') +
        '<h3 class="iv-h3 iv-mt">Where copies are</h3><p class="small">' + (F.internal.length ? 'Inside Northstar: ' + F.internal.map(function (x) { return chip(x); }).join(' ') : 'No internal copies found.') + '</p><p class="small">' + (F.vendors.length ? 'Vendors: ' + F.vendors.map(function (x) { return chip(x); }).join(' ') + (F.subs.length ? ' → ' + F.subs.map(function (x) { return chip(x); }).join(' ') : '') : '<span class="ok">No vendor holds a copy.</span>') + '</p>' +
        (F.joins.length ? '<p class="small">Unsanctioned joins: ' + F.joins.map(function (j) { return esc(P.name(j[0]) + ' ↔ ' + P.name(j[1])); }).join('; ') + '</p>' : '') + '</div></div>' +
    '<div class="card iv-mt"><h3 class="iv-h3">Promises at stake</h3>' + promiseList(ps) + (risk ? '<h3 class="iv-h3 iv-mt">Residual risk today</h3>' + P.riskHTML(P.explainRisk(risk, P.promisesFor(risk.id)[0] || null), { brief: true }) : '') +
      '<h3 class="iv-h3 iv-mt">From promise to owner</h3>' + P.chainHTML(d.id) + P.cite([d.id].concat(F.vendors, F.internal, risk ? [risk.id] : []), 'Built from') + '</div>' +
    '<p class="small dim iv-mt">An illustrative model, in bands. Each dimension is rated none, low, moderate or high from the records: people (under a hundred thousand is low, ten million or more is high), sensitivity tier, the oldest record, the identifier’s class, who holds the keys (or who can look, or the vendor’s retention), and how many copies and unsanctioned joins exist. The band follows from how many dimensions are high; per-person keys hold a breach at Limited. Unknown inputs count as the worst case.</p>';
}, mount: function (root) {
  var st = P.state.wd, F = P.wdFacts(st.ds);
  function upd() { root.querySelector('#wdOut').innerHTML = wdResultHTML(F, st); root.querySelector('#wdBest').innerHTML = wdBestHTML(F, st); labelScrollers(root); }
  wire(root);
  root.querySelector('#wdDs').addEventListener('change', function () { P.go('privacy/worstday?ds=' + encodeURIComponent(this.value)); });
  root.querySelectorAll('input[name="wdSc"]').forEach(function (r) { r.addEventListener('change', function () { st.sc = r.value; upd(); }); });
  root.querySelectorAll('[data-wd]').forEach(function (c) { c.addEventListener('change', function () { st.on[c.getAttribute('data-wd')] = c.checked; upd(); }); });
  root.querySelector('#wdReset').addEventListener('click', function () { st.on = JSON.parse(JSON.stringify(F.today)); root.querySelectorAll('[data-wd]').forEach(function (c) { c.checked = !!st.on[c.getAttribute('data-wd')]; }); upd(); });
} };

/* ═════════════ RISK RADAR ═════════════ */
function lvWord(v) { return v <= 1 ? 'low' : v <= 3 ? 'moderate' : 'high'; }
function radarSVG(r) {
  var ex = NS.riskFactors.filter(function (f) { return f.kind === 'exposure'; }), n = ex.length, S = 340, cx = S / 2, cy = S / 2 + 4, R = 118;
  var pt = function (i, v) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v / 5, cy + Math.sin(a) * R * v / 5]; };
  var s = '<svg class="iv-radar" viewBox="-46 0 ' + (S + 92) + ' ' + (S + 6) + '" width="100%" role="img" aria-label="' + esc('Exposure shape of ' + r.name + ': ' + ex.map(function (f) { return f.label.toLowerCase() + ' ' + lvWord(r.f[f.k]); }).join(', ')) + '">';
  [[1.5, 'low'], [3.5, 'moderate'], [5, 'high']].forEach(function (g) { s += '<polygon points="' + ex.map(function (f, i) { return pt(i, g[0]).map(function (z) { return z.toFixed(1); }).join(','); }).join(' ') + '" fill="none" stroke="#d5cfc2" stroke-dasharray="' + (g[0] === 5 ? '' : '3 3') + '"/>'; });
  ex.forEach(function (f, i) { var p = pt(i, 5); s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#e4dfd4"/>'; });
  s += '<text x="' + (cx + 4) + '" y="' + (cy - R * 1.5 / 5 + 3) + '" fill="#6b6457" font-size="9">low</text><text x="' + (cx + 4) + '" y="' + (cy - R * 3.5 / 5 + 3) + '" fill="#6b6457" font-size="9">moderate</text><text x="' + (cx + 4) + '" y="' + (cy - R + 10) + '" fill="#6b6457" font-size="9">high</text>';
  s += '<polygon points="' + ex.map(function (f, i) { return pt(i, Math.max(0.3, r.f[f.k])).map(function (z) { return z.toFixed(1); }).join(','); }).join(' ') + '" fill="#b3400b" fill-opacity=".16" stroke="#b3400b" stroke-width="1.6"/>';
  ex.forEach(function (f, i) { var p = pt(i, 6.15), a = p[0] < cx - 8 ? 'end' : p[0] > cx + 8 ? 'start' : 'middle'; var lab = f.label.replace(' / regulatory exposure', '').replace('Number of people', 'People').replace('Third-party exposure', 'Third parties').replace('Data sensitivity', 'Sensitivity').replace('Purpose novelty', 'New purpose').replace('Access breadth', 'Access'); s += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 3).toFixed(1) + '" fill="#3a4250" font-size="10.5" text-anchor="' + a + '">' + esc(lab) + '</text>'; });
  return s + '</svg>';
}
function riskFactorTable(r) {
  return '<div class="tbl-wrap"><table class="tbl iv-tbl iv-rf"><caption class="sr-only">Factors behind ' + esc(r.name) + '</caption><thead><tr><th scope="col">Factor</th><th scope="col">Kind</th><th scope="col">Level</th></tr></thead><tbody>' +
    NS.riskFactors.map(function (f) { var v = r.f[f.k], as = f.kind === 'assurance'; var w = as ? (v >= 4 ? 'strong' : v >= 2 ? 'partial' : 'weak') : lvWord(v); return '<tr><th scope="row">' + esc(f.label) + '</th><td class="small">' + (as ? 'safeguard' : 'exposure') + '</td><td><span class="iv-lv ' + (as ? 'lvl-w lvl-' + w : 'iv-lv' + (w === 'low' ? 1 : w === 'moderate' ? 2 : 3)) + '">' + w + '</span></td></tr>'; }).join('') + '</tbody></table></div>';
}
V['privacy/risks'] = { title: 'Risk radar', render: function (s, q) {
  var rs = P.risksSorted(), sel = q.r && typeOf(q.r) === 'risk' ? ent(q.r) : rs[0];
  var ex = function (r) { return P.explainRisk(r, P.promisesFor(r.id)[0] || null); };
  var bands = { HIGH: 0, MEDIUM: 0, LOW: 0 }; rs.forEach(function (r) { bands[ex(r).band]++; });
  var X = ex(sel), ps = promisesOf([sel.id, sel.asset].concat(sel.findings)), dec = ps.map(function (p) { return p.decision; }).filter(Boolean)[0];
  var list = '<ol class="iv-risks">' + rs.map(function (r) {
    var x = ex(r), rp = P.promisesFor(r.id);
    return '<li class="iv-risk' + (r === sel ? ' sel' : '') + '"><a class="iv-risk-a" href="#/privacy/risks?r=' + r.id + '"' + (r === sel ? ' aria-current="true"' : '') + '><span class="rx-band rx-' + x.band.toLowerCase() + '">' + esc(x.likely) + '</span> <b>' + esc(r.name) + '</b></a>' +
      '<p class="small">' + esc(x.sentence) + '</p><p class="small dim">confidence ' + x.confidence + (rp.length ? ' · ' + rp.map(function (p) { return p.id; }).join(', ') : '') + ' · ' + pl(r.findings.length, 'finding') + '</p></li>';
  }).join('') + '</ol>';
  return P.pageHead('Decide', 'Risk radar', 'Every privacy risk in words: its band, what drives it, which safeguards hold, what we don’t know, and how confident we are. The radar shows the <i>shape</i> of the exposure — which factors are high — never a score.') +
    '<p class="iv-answer"><b>' + pl(rs.length, 'rated risk') + '</b>: ' + bands.HIGH + ' high, ' + bands.MEDIUM + ' medium, ' + bands.LOW + ' low. ' + (function (n) { return n + (n === 1 ? ' is' : ' are'); })(rs.filter(function (r) { return ex(r).confidence === 'low'; }).length) + ' rated with low confidence because key inputs are unknown.</p>' +
    P.cite(rs.map(function (r) { return r.id; }), 'Built from') +
    '<div class="iv-rgrid"><div class="card iv-rsel"><div class="card-h"><h2 class="sec">' + esc(sel.name) + '</h2><span class="sub">' + chip(sel.asset) + '</span></div>' +
      '<div class="iv-rtop"><figure class="iv-fig"><figcaption class="small dim">Exposure shape: the further out, the higher the factor</figcaption>' + radarSVG(sel) + '<div class="legend iv-legend"><span><i style="background:#b3400b"></i>this risk’s exposure</span><span><i class="iv-ring"></i>rings: low · moderate · high</span></div></figure>' +
      '<div><h3 class="iv-h3">Why it is rated this way</h3><h4 class="sr-only">Band, drivers, safeguards and unknowns</h4>' + P.riskHTML(X) + '<h3 class="iv-h3 iv-mt">Safeguards, tested or not</h3><ul class="checks">' + sel.mitigating.map(function (m) { return P.check(m[1], esc(m[0])); }).join('') + '</ul></div></div>' +
      '<details class="iv-more"><summary>Every factor, as a table</summary>' + riskFactorTable(sel) + '</details>' +
      '<h3 class="iv-h3 iv-mt">Promises at stake</h3>' + promiseList(ps) + (dec ? '<p class="small">Decision: ' + chip(dec, dec) + ' <a class="small" href="#/decisions/' + esc(dec) + '">open the memo →</a></p>' : '<p class="small">' + unk('no decision opened for this risk') + '</p>') +
      '<h3 class="iv-h3 iv-mt">From promise to owner</h3>' + P.chainHTML(sel.id) + P.cite([sel.id, sel.asset].concat(sel.findings), 'Evidence') + '</div>' +
    '<div class="card iv-rlist"><h2 class="sec">All risks</h2>' + list + '</div></div>';
}, mount: wire };
})();
