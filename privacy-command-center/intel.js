/* Universal privacy search, the Privacy Analyst, and the guided investigation.
 * Nothing here is a language model. Questions are matched to structured
 * queries over the graph; every answer lists the evidence it came from and
 * labels each statement FACT, INFERENCE, RECOMMENDATION or UNKNOWN. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN;

function hasField(d, re) { return d.fields.some(function (f) { return re.test(f[0]); }); }

/* ── search intents ─────────────────────────────────────── */
var INTENTS = [
  { k: ['precise location', 'location', 'gps', 'lat', 'coordinates', 'who has location'], q: 'Who has precise location?', run: function () {
      var ds = NS.datasets.filter(function (d) { return hasField(d, /lat|lon|precise/); });
      var v = NS.vendors.filter(function (x) { return x.data.some(function (f) { return /lat|lon/.test(f); }); });
      return { s: ds.length + ' datasets hold precise coordinates; ' + v.length + ' recipient outside Northstar receives them.', items: ds.map(function (d) { return { id: d.id, why: d.accessPeople + ' people · ' + d.accessServices + ' services · ' + P.fmtDays(d.retention.actual) }; }).concat(v.map(function (x) { return { id: x.id, why: 'receives ' + x.data.join(', ') }; })), rule: 'fields matching lat|lon|precise; vendors whose payload includes coordinates' }; } },
  { k: ['vendors receive email', 'email', 'emails', 'who gets email'], q: 'Which vendors receive emails?', run: function () {
      var v = NS.vendors.filter(function (x) { return x.data.some(function (f) { return /email/.test(f); }); });
      return { s: v.length + ' vendors receive an email or a hashed email. Hashing is not anonymisation: the same input gives the same hash everywhere.', items: v.map(function (x) { return { id: x.id, why: x.data.filter(function (f) { return /email/.test(f); }).join(', ') + ' · ' + x.role }; }), rule: 'vendor payload contains email or hashed_email' }; } },
  { k: ['health', 'health data', 'medical', 'cycle', 'special category'], q: 'Where is health data stored?', run: function () {
      var ds = NS.datasets.filter(function (d) { return d.fields.some(function (f) { return f[1] === 4 && /cycle|symptom|health|pregnan|rhr|notes|screen/.test(f[0]); }); });
      return { s: ds.length + ' datasets hold health data. Two are well protected (per-user keys, runtime purpose checks). The rest were never designed to hold it.', items: ds.map(function (d) { return { id: d.id, why: P.name(d.system) + ' · ' + d.regions.join(', ') + ' · ' + d.encryption }; }), rule: 'T4 fields about health, symptoms, cycles, heart rate, or health inferences' }; } },
  { k: ['ignore consent', 'revocation', 'consent', 'opt out', 'stale consent'], q: 'Which systems ignore consent revocation?', run: function () {
      var c = NS.consentConsumers.filter(function (x) { return x.p50 == null; });
      return { s: c.length + ' consumers never receive a revocation; ' + fmtN(c.reduce(function (s, x) { return s + x.stale; }, 0)) + ' people are processed on stale consent.', items: c.map(function (x) { return { id: x.id, why: x.mode }; }), rule: 'consent consumers with no propagation path' }; } },
  { k: ['ttl', 'no ttl', 'retention', 'tables have no ttl', 'kept forever'], q: 'Which tables have no TTL?', run: function () { var m = P.metric('nottl'); return { s: m.items().length + ' datasets rely on someone remembering to delete.', items: m.items(), rule: m.rule }; } },
  { k: ['account id', 'advertising id', 'maid', 'joined', 'join'], q: 'Where is account ID joined to advertising ID?', run: function () {
      var j = NS.idJoins.filter(function (x) { return (x[0] === 'i_customer' && x[1] === 'i_maid') || (x[1] === 'i_customer' && x[0] === 'i_maid') || (x[1] === 'i_maid' && !x[4]); });
      return { s: j.length + ' join paths reach the advertising ID; none of them were sanctioned.', items: j.map(function (x) { return { id: x[2] || x[0], why: P.name(x[0]) + ' ↔ ' + P.name(x[1]) + ' — ' + x[3] }; }), rule: 'identifier joins that end at i_maid and are not sanctioned' }; } },
  { k: ['train on conversations', 'training', 'ai', 'model', 'conversations', 'prompts'], q: 'Which AI systems train on conversations?', run: function () {
      var m = NS.models.filter(function (x) { return x.training.some(function (t) { return t === 'd_prompts' || t === 'd_transcripts'; }); });
      return { s: m.length + ' models are trained on conversations. For one, whether the provider trains on the input is unknown.', items: m.map(function (x) { return { id: x.id, why: x.hosting + ' · trains on input: ' + (x.trainsOnUserInput == null ? 'UNKNOWN' : x.trainsOnUserInput) }; }), rule: 'models whose training data includes prompt logs or support transcripts' }; } },
  { k: ['not confirmed deletion', 'vendor deletion', 'vendors deletion', 'deletion confirmation'], q: 'Which vendors have not confirmed deletion?', run: function () {
      var w = NS.deletionTargets.filter(function (t) { return P.get(t[0]).type === 'vendor' && t[3] !== 'verified'; }).map(function (t) { return { id: t[0], why: 'Forget-Me: ' + t[3] }; });
      var n = NS.vendors.filter(function (v) { return !v.deletionApi; }).map(function (v) { return { id: v.id, why: 'no deletion mechanism at all' }; });
      return { s: w.length + ' vendors are still waiting to confirm; ' + n.length + ' have no way to delete.', items: w.concat(n), rule: 'vendor Forget-Me targets not verified + vendors without a deletion API' }; } },
  { k: ['leave europe', 'europe', 'eu', 'transfer', 'cross-border', 'leaves'], q: 'What data leaves Europe?', run: function () {
      var t = NS.transfers.filter(function (x) { return /^eu/.test(x.from) && !/^eu/.test(x.to); });
      return { s: t.length + ' transfers leave Europe; ' + t.filter(function (x) { return /none|unknown/.test(x.basis); }).length + ' have no transfer basis on file.', items: t.map(function (x) { return { id: x.flow || x.to, why: x.from + ' → ' + x.to + ': ' + x.what + ' (basis: ' + x.basis + ')' }; }), rule: 'transfers from eu-* regions to non-EU regions' }; } },
  { k: ['full url', 'urls', 'url logged', 'query string'], q: 'Where are full URLs logged?', run: function () {
      var ds = NS.datasets.filter(function (d) { return hasField(d, /url/); });
      return { s: ds.length + ' datasets store URLs. A full URL can carry names, tokens and the fact that someone visited a clinic.', items: ds.map(function (d) { return { id: d.id, why: d.fields.filter(function (f) { return /url/.test(f[0]); }).map(function (f) { return f[0]; }).join(', ') + ' · ' + P.fmtDays(d.retention.actual) }; }), rule: 'fields named *url*' }; } },
  { k: ['only in documentation', 'documents', 'paper', 'policy only'], q: 'Which controls exist only in documentation?', run: function () { var m = P.metric('paper'); return { s: m.items().length + ' controls are text nobody checks.', items: m.items(), rule: m.rule }; } },
  { k: ['changed this week', 'what changed', 'drift', 'new this week'], q: 'What changed this week?', run: function () { var m = P.metric('drift'); return { s: m.items().length + ' privacy-relevant changes in the last seven days.', items: m.items(), rule: m.rule }; } },
  { k: ['forget-me', 'forget me', 'fail a forget', 'deletion fail', 'delete'], q: 'What systems would fail a Forget-Me request?', run: function () { var m = P.metric('delfail'); return { s: m.items().length + ' systems cannot prove deletion, plus one dead-letter queue the orchestrator does not know about.', items: m.items(), rule: m.rule }; } },
  { k: ['infer about one customer', 'one customer', 'one person', 'dossier', 'what can this company infer'], q: 'What can this company infer about one customer?', run: function () { return { s: 'Open the One Person view: ' + NS.persona.facts.length + ' facts and inferences are reachable from an email and a device ID.', items: [], go: 'explore/person', rule: 'graph traversal from two starting identifiers' }; } },
  { k: ['unknown owner', 'no owner', 'orphan', 'unowned'], q: 'What has no owner?', run: function () { var m = P.metric('noowner'); return { s: m.items().length + ' assets have no accountable team. Unknown owner = finding.', items: m.items(), rule: m.rule }; } }
];
P.INTENTS = INTENTS;
function score(intent, q) { var s = 0; intent.k.forEach(function (k) { if (q.indexOf(k) >= 0) s += k.length; }); if (intent.q.toLowerCase().indexOf(q) >= 0 && q.length > 3) s += 3; return s; }
function search(q) {
  q = q.trim().toLowerCase();
  var best = null, bs = 0; if (q) INTENTS.forEach(function (i) { var s = score(i, q); if (s > bs) { bs = s; best = i; } });
  var ents = q.length > 1 ? Object.keys(P.ENT).filter(function (id) { var n = P.name(id).toLowerCase(); return n.indexOf(q) >= 0 || id.toLowerCase() === q; }).slice(0, 12) : [];
  return { intent: bs >= 3 ? best : null, ents: ents };
}
var sel = 0;
function renderPalette() {
  var q = document.getElementById('paletteInput').value, box = document.getElementById('paletteResults'), r = search(q), h = '';
  if (r.intent) {
    var a = r.intent.run();
    h += '<div class="answer"><div class="ah">' + esc(r.intent.q) + '</div><div class="stmt"><span class="tag k-FACT">FACT</span><span>' + esc(a.s) + '</span></div><div class="rule">query: ' + esc(a.rule) + '</div>' + (a.go ? '<div style="margin-top:8px"><button class="btn primary" data-go="' + a.go + '" data-close="1">Open →</button></div>' : '') + '</div>';
    if (a.items.length) h += '<div class="pr-group">Evidence · ' + a.items.length + '</div>' + a.items.map(function (it) { return '<button class="pr" data-ent="' + esc(it.id) + '" data-close="1"><span class="tag">' + esc((P.TYPE_LABEL[P.get(it.id) ? P.get(it.id).type : ''] || '').split(' ')[0]) + '</span><span><div>' + esc(P.name(it.id)) + '</div><div class="pw">' + esc(it.why || '') + '</div></span><span class="dim">↵</span></button>'; }).join('');
  }
  if (r.ents.length) h += '<div class="pr-group">Entities</div>' + r.ents.map(function (id) { return '<button class="pr" data-ent="' + esc(id) + '" data-close="1"><span class="tag">' + esc((P.TYPE_LABEL[P.get(id).type] || '').split(' ')[0]) + '</span><span>' + esc(P.name(id)) + '</span><span class="dim">↵</span></button>'; }).join('');
  if (!q.trim() || (!r.intent && !r.ents.length)) {
    h += (q.trim() ? '<div class="answer"><div class="stmt"><span class="tag k-UNKNOWN">UNKNOWN</span><span>No structured query matches that yet. Try one of these:</span></div></div>' : '') + '<div class="pr-group">Ask</div>' + INTENTS.map(function (i) { return '<button class="pr" data-ask="' + esc(i.q) + '"><span class="tag">Q</span><span>' + esc(i.q) + '</span><span class="dim">↵</span></button>'; }).join('');
  }
  box.innerHTML = h; sel = 0; mark();
}
function mark() { var items = document.querySelectorAll('#paletteResults .pr'); items.forEach(function (b, i) { b.classList.toggle('sel', i === sel); }); if (items[sel]) items[sel].scrollIntoView({ block: 'nearest' }); }
var lastFocus = null;
P.openPalette = function (q) { lastFocus = document.activeElement; var p = document.getElementById('palette'); p.hidden = false; var i = document.getElementById('paletteInput'); i.value = q || ''; renderPalette(); i.focus(); };
P.closePalette = function () { document.getElementById('palette').hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); };

/* ── analyst ────────────────────────────────────────────── */
function S(k, t, cite) { return { k: k, t: t, cite: cite || [] }; }
var AQ = [
  ['What are our largest privacy exposures?', function () {
    return P.risksSorted().slice(0, 4).map(function (r) { var c = P.riskCalc(r); return S('FACT', r.name + ': residual ' + c.residual + ' (' + c.rating + '). ' + r.why.slice(0, 3).join('; ') + '.', [r.id, r.asset].concat(r.findings)); })
      .concat([S('INFERENCE', 'The common thread is purpose drift enabled by durable, shared identifiers: fraud, location and health signals reach advertising because the same IDs appear on both sides.', ['i_customer', 'i_device', 'i_maid']), S('RECOMMENDATION', 'Fund purpose-scoped identifiers and query-time purpose enforcement as platform work; they close three of the top four risks at once.', ['c_id_scope', 'c_purpose_runtime'])]);
  }],
  ['Find sensitive information leaving the company.', function () {
    var f = NS.flows.filter(function (x) { return x.boundary === 'third_party' && x.tier >= 3; });
    return f.map(function (x) { return S(x.status === 'unknown' ? 'UNKNOWN' : 'FACT', P.name(x.id) + ': ' + x.fields.join(', ') + (x.status !== 'reviewed' ? ' — ' + x.status + ', nobody signed off' : ''), [x.id, x.to]); })
      .concat([S('RECOMMENDATION', 'Make the egress review a deployment gate for every new destination, including “pre-approved” hosts — the browser telemetry export bypassed it that way.', ['c_gate_egress'])]);
  }],
  ['Find incompatible data uses.', function () {
    var f = NS.flows.filter(function (x) { return (x.flags || []).indexOf('purpose_change') >= 0; });
    return f.map(function (x) { var src = NS.datasets.filter(function (d) { return d.system === x.from; })[0]; return S('FACT', 'Collected for ' + (src ? src.purposes.join(', ') || 'an undeclared purpose' : 'another purpose') + '; used for ' + x.purpose + ' by ' + P.name(x.to) + '.', [x.id].concat(src ? [src.id] : [])); })
      .concat([S('INFERENCE', 'Each of these was approved by a person or never reviewed at all; none was blocked by a machine.', ['c_purpose_fs']), S('RECOMMENDATION', 'Carry purpose tags on the data and evaluate them at read time, as Pulse already does.', ['c_purpose_runtime'])]);
  }],
  ['Where could pseudonymous data be re-identified?', function () {
    return [S('FACT', 'The Pulse user ID was designed as purpose-scoped. The identity job joins it to the device ID and the advertising ID.', ['i_pulse', 's_idres', 'PRV-0233']),
      S('FACT', 'Hashed emails go to three recipients. A partner can hash its own users\' emails and match exactly — that match is the product.', ['i_hemail', 'v_adreach', 'v_pixelpeak']),
      S('INFERENCE', 'purchase_events carries precise coordinates and timestamps: a handful of points reveals home and work, so the device ID alone is enough to name someone.', ['d_purchase']),
      S('UNKNOWN', 'Whether the unlisted subprocessors receiving Clearsight and GeoGrid data hold other datasets to join against.', ['sp_unknown_1', 'sp_unknown_3']),
      S('RECOMMENDATION', 'Rotate the Pulse install ID, remove MAID from the SDK beacon, and coarsen coordinates to city at collection.', ['PRV-0233', 'PRV-0214'])];
  }],
  ['Which privacy controls exist only on paper?', function () {
    return NS.controls.filter(function (c) { return c.level === 0 || (c.level === 1 && c.health === 'failing'); }).map(function (c) { return S('FACT', c.name + ' — L' + c.level + ' ' + P.LEVELS[c.level] + '; evidence: ' + c.evidence + '.', [c.id]); })
      .concat([S('RECOMMENDATION', 'Start with the retention policy: the drift scanner (L5) already measures it, so turning the wiki page into a TTL gate is days of work.', ['c_ttl_wh', 'c_retention_scan'])]);
  }],
  ['What should we fix first?', function () {
    var ranked = P.openFindings().filter(function (f) { return f.sev === 'HIGH'; }).map(function (f) { var ctl = f.entities.filter(function (e) { return P.get(e) && P.get(e).type === 'control'; }).map(function (e) { return P.get(e).obj.level; }); var gap = f.enforcement - (ctl.length ? Math.max.apply(null, ctl) : 0); return { f: f, s: Math.log10(f.people) * 2 + Math.max(0, gap) + (P.daysUntil(f.due) < 7 ? 2 : 0) + (f.owner ? 0 : 2) }; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 5);
    return [S('FACT', 'Ranked by people affected (log), the gap between the control that exists and the level required, due date, and whether anyone owns it.', [])].concat(ranked.map(function (x, i) { return S('RECOMMENDATION', (i + 1) + '. ' + x.f.title + ' — first step: ' + x.f.mitigations[0].toLowerCase() + '.', [x.f.id]); }));
  }],
  ['What don\'t we know?', function () {
    var out = [];
    NS.datasets.forEach(function (d) { P.six(d).why.filter(function (w) { return P.six(d)[w[0]] === 'u'; }).forEach(function (w) { out.push(S('UNKNOWN', d.name + ': ' + w[1] + '.', [d.id])); }); });
    NS.flows.filter(function (f) { return f.status === 'unknown'; }).forEach(function (f) { out.push(S('UNKNOWN', 'Undescribed flow: ' + P.name(f.id) + '.', [f.id])); });
    out.push(S('INFERENCE', 'Unknowns cluster around one unowned job and two SDKs. Each unknown is a finding: unknown owner, retention, vendor, purpose and deletion path.', ['s_idres', 'v_geogrid', 's_pulsesdk']));
    return out;
  }]
];
function ctxFinding() { var st = P.state.drawerStack; for (var i = st.length - 1; i >= 0; i--) if (P.get(st[i]).type === 'finding') return st[i]; return 'PRV-0217'; }
function ctxEntity() { var st = P.state.drawerStack; return st.length ? st[st.length - 1] : 's_idres'; }
AQ.push(['Explain this finding to an engineer.', function () { return explainEng(ctxFinding()); }]);
AQ.push(['Explain this finding to the CPO.', function () { return explainCPO(ctxFinding()); }]);
AQ.push(['Generate questions for the system owner.', function () {
  var id = ctxEntity(), e = P.get(id), qs = [];
  var ds = e.type === 'dataset' ? [e.obj] : NS.datasets.filter(function (d) { return d.system === id; });
  qs.push(S('FACT', 'Questions for the owner of ' + e.name + (e.obj.team || e.obj.owner ? ' (' + P.name(e.obj.team || e.obj.owner) + ')' : ' — which has no owner, so the first question is who that is') + ':', [id]));
  ['What customer outcome needs this data, and what breaks if it is gone?', 'Which fields could be removed, generalised, or computed on the device?', 'Who and what can join it — and which joins did you intend?', 'After the decision is made, do you still need the raw event?', 'If a person asks to be forgotten, how do you prove every copy is gone?'].forEach(function (q) { qs.push(S('RECOMMENDATION', q, [])); });
  ds.forEach(function (d) { P.six(d).why.forEach(function (w) { qs.push(S(P.six(d)[w[0]] === 'u' ? 'UNKNOWN' : 'FACT', d.name + ': ' + w[1] + ' — please answer.', [d.id])); }); });
  return qs;
}]);
AQ.push(['Suggest privacy-preserving alternatives.', function () {
  var id = ctxEntity(), e = P.get(id);
  var pets = NS.pets.filter(function (p) { return p.fit.some(function (f) { return f === id || (e.obj.feature && f === e.obj.feature) || (e.obj.system && P.get(e.obj.system) && P.get(e.obj.system).obj.feature === f); }); });
  if (!pets.length) pets = NS.pets.filter(function (p) { return ['minimize', 'ondevice', 'retention', 'pseudo'].indexOf(p.id) >= 0; });
  return [S('FACT', 'Context: ' + e.name + '.', [id])].concat(pets.map(function (p) { return S('RECOMMENDATION', p.name + ' — ' + p.benefit + ' Cost: ' + p.utility.toLowerCase() + '; trust in ' + p.trust.toLowerCase() + '. Residual: ' + p.residual.toLowerCase() + '.', [p.id]); })).concat([S('INFERENCE', 'State the threat first: a technique that does not address it adds complexity without reducing exposure.', [])]);
}]);
function explainEng(fid) {
  var f = P.get(fid).obj;
  var flows = f.entities.filter(function (e) { return P.get(e) && P.get(e).type === 'flow'; });
  return [S('FACT', f.id + ' — ' + f.title + '. Detected by: ' + f.detector + '.', [fid]),
    flows.length ? S('FACT', 'The path: ' + flows.map(function (x) { var o = P.get(x).obj; return P.name(o.from) + ' → ' + P.name(o.to) + ' carrying ' + o.fields.join(', '); }).join('; ') + '.', flows) : S('FACT', 'Entities: ' + f.entities.map(P.name).join(', ') + '.', f.entities),
    S('INFERENCE', 'Harm class: ' + f.harms.join(', ') + '. LINDDUN: ' + f.linddun.join(', ') + '.', []),
    S('RECOMMENDATION', 'Ship, in order: ' + f.mitigations.slice(0, 3).join('; ') + '. The fix must reach L' + f.enforcement + ' (' + P.LEVELS[f.enforcement] + ') — a doc change will not close it.', [fid]),
    f.owner ? S('FACT', 'Owner: ' + P.name(f.owner) + ', due ' + f.due + '.', [f.owner]) : S('UNKNOWN', 'No owner. Assign one before anything else.', [fid])];
}
function explainCPO(fid) {
  var f = P.get(fid).obj;
  return [S('FACT', fmtN(f.people) + ' people are affected.', [fid]), S('FACT', 'What can happen to them: ' + f.human, [fid]),
    S('INFERENCE', 'Likelihood is not hypothetical: the detector observed it in production on ' + f.opened + '.', []),
    S('RECOMMENDATION', 'Decision: approve “' + f.mitigations[0] + '” now; fund “' + (f.mitigations[1] || f.mitigations[0]) + '” as the durable fix. Product impact is small; the trade-off is written in the memo.', [fid])];
}
P.acts.explainEng = function (el) { P.openAnalyst(); answer('Explain ' + el.getAttribute('data-id') + ' to an engineer', explainEng(el.getAttribute('data-id'))); };
P.acts.explainCPO = function (el) { P.openAnalyst(); answer('Explain ' + el.getAttribute('data-id') + ' to the CPO', explainCPO(el.getAttribute('data-id'))); };
function answer(q, stmts) {
  var body = document.getElementById('analystBody');
  var h = '<div class="msg"><div class="mq">' + esc(q) + '</div>' + stmts.map(function (s) { return '<div class="stmt"><span class="tag k-' + s.k + '">' + s.k + '</span><span>' + esc(s.t) + (s.cite.length ? '<span class="cite">' + P.uniq(s.cite).filter(function (c) { return P.get(c); }).map(function (c) { return chip(c); }).join('') + '</span>' : '') + '</span></div>'; }).join('') + '</div>';
  var host = document.getElementById('aAnswers'); host.insertAdjacentHTML('afterbegin', h);
  body.scrollTop = 0;
}
P.openAnalyst = function () {
  var a = document.getElementById('analyst'), body = document.getElementById('analystBody');
  if (!body.innerHTML) {
    body.innerHTML = '<p class="small muted" style="margin-top:0">Answers are composed from the privacy graph — no language model, nothing invented. Every statement is labelled and cites the evidence. <b>UNKNOWN is treated as information</b>: an unknown owner, retention, vendor, purpose or deletion path is itself a finding.</p>' +
      '<div class="legend" style="margin-bottom:12px"><span class="tag k-FACT">FACT</span><span class="tag k-INFERENCE">INFERENCE</span><span class="tag k-RECOMMENDATION">RECOMMENDATION</span><span class="tag k-UNKNOWN">UNKNOWN</span></div>' +
      '<div class="aq">' + AQ.map(function (x, i) { return '<button data-aq="' + i + '">' + esc(x[0]) + '</button>'; }).join('') + '</div><div id="aAnswers"></div>';
    body.addEventListener('click', function (ev) { var b = ev.target.closest('[data-aq]'); if (!b) return; var x = AQ[+b.getAttribute('data-aq')]; answer(x[0], x[1]()); });
    answer(AQ[0][0], AQ[0][1]());
  }
  a.classList.add('open'); a.removeAttribute('inert'); document.getElementById('analystBtn').setAttribute('aria-expanded', 'true');
};
P.closeAnalyst = function () { var a = document.getElementById('analyst'); a.classList.remove('open'); a.setAttribute('inert', ''); document.getElementById('analystBtn').setAttribute('aria-expanded', 'false'); };

/* ── guided investigation ──────────────────────────────── */
var TOUR = [
  { t: 'HIGH RISK', h: 'Start where the number is', p: 'Every number on the Command Center is clickable and explained. This one is the list of open HIGH findings — and the rule that produced it.', go: 'overview', act: function () { P.openMetric('highfind'); var t = document.querySelector('[data-metric="highfind"]'); if (t) { t.classList.add('hl'); t.scrollIntoView({ block: 'center' }); } } },
  { t: 'PRODUCTS → CHECKOUT', h: 'Pick the product', p: 'Checkout carries several of them. Its passport lists features, systems, datasets and every open finding that touches it.', go: 'explore/products', open: 'p_checkout' },
  { t: 'SYSTEMS → FRAUD ANALYTICS', h: 'Into the fraud system', p: 'The Fraud Service writes derived features — velocity, IP risk, device fingerprint — to a feature store with a verified 180-day TTL. So far, good architecture.', go: 'explore/systems', open: 's_fraudsvc' },
  { t: 'DATA FLOW', h: 'An arrow nobody reviewed', p: 'From the feature store, customer ID and device fingerprint cross an internal trust boundary into the Marketing Audience Builder. Every arrow is a decision; this one was never made.', go: 'explore/flows?f=fl10', open: 'fl10' },
  { t: 'IDENTITY GRAPH', h: 'The join', p: 'The fingerprint is a cross-app identifier. In the marketing job it meets the advertising ID — a join nobody sanctioned.', go: 'explore/identities', open: 'i_fp' },
  { t: 'VENDOR', h: 'Where it leaves', p: 'The audience export goes to AdReach Network, with the fraud score band attached. Opt-outs are not reaching them either.', go: 'explore/vendors', open: 'v_adreach' },
  { t: 'PURPOSE', h: 'Declared vs actual', p: 'Declared purpose: fraud_prevention. Actual consumer: Marketing Audience Builder. Purpose was checked at collection, never at use.', go: 'privacy/purpose', open: 'd_fraudfeat' },
  { t: 'FINDING', h: 'PURPOSE DRIFT + CROSS-CONTEXT LINKABILITY', p: 'Technical issue → privacy harm → human consequence, the owner, the due date, and the evidence that produced it.', go: 'privacy/risks?r=R-03', open: 'PRV-0217' },
  { t: 'MITIGATIONS', h: 'What reduces it', p: 'Separate identity, tokenise, scope purpose, remove the advertising consumer, shorten retention — and enforce at runtime.', go: 'privacy/risks?r=R-03', open: 'PRV-0217', scroll: 'mitigations' },
  { t: 'ENFORCEMENT', h: 'Is the control actually working?', p: 'The control that should have stopped it is a human approval (L1) and it failed. The fix must reach runtime enforcement — out of the document and into the machine.', go: 'assurance/controls?d=Purpose', open: 'c_purpose_fs' }
];
var step = -1;
function showStep(i) {
  step = i; var s = TOUR[i], el = document.getElementById('tour');
  el.hidden = false;
  el.innerHTML = '<div class="st">INVESTIGATION · ' + (i + 1) + ' / ' + TOUR.length + ' · ' + esc(s.t) + '</div><h3>' + esc(s.h) + '</h3><p>' + esc(s.p) + '</p><div class="nav"><div class="dots">' + TOUR.map(function (x, k) { return '<i class="' + (k <= i ? 'on' : '') + '"></i>'; }).join('') + '</div><div class="btn-row"><button class="btn ghost" data-tour="end">End</button>' + (i > 0 ? '<button class="btn" data-tour="prev">Back</button>' : '') + (i < TOUR.length - 1 ? '<button class="btn primary" data-tour="next">Next →</button>' : '<button class="btn primary" data-tour="end">Done — WHY answered</button>') + '</div></div>';
  var target = '#/' + s.go;
  var done = function () { if (s.act) s.act(); if (s.open) P.open(s.open, { noFocus: true, scrollTo: s.scroll }); };
  if (location.hash !== target) { location.hash = target; setTimeout(done, 60); } else done();
}
P.acts.tour = function () { P.closePalette && !document.getElementById('palette').hidden && P.closePalette(); showStep(0); };
document.addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-tour]'); if (b) { var a = b.getAttribute('data-tour'); if (a === 'next') showStep(step + 1); else if (a === 'prev') showStep(step - 1); else { document.getElementById('tour').hidden = true; step = -1; } return; }
  var ask = ev.target.closest('[data-ask]'); if (ask) { document.getElementById('paletteInput').value = ask.getAttribute('data-ask'); renderPalette(); document.getElementById('paletteInput').focus(); return; }
  if (ev.target.closest('[data-close]') && !document.getElementById('palette').hidden) setTimeout(function () { document.getElementById('palette').hidden = true; }, 0);
  if (ev.target.id === 'palette') P.closePalette();
});

P.initIntel = function () {
  var inp = document.getElementById('paletteInput');
  inp.addEventListener('input', renderPalette);
  inp.addEventListener('keydown', function (ev) {
    var items = document.querySelectorAll('#paletteResults .pr');
    if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(items.length - 1, sel + 1); mark(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); if (items[sel]) items[sel].click(); }
  });
};
})();
