/* Views: Assurance (Auditor), Governance, Report. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk;
var V = P.views;

/* ════════════ ENFORCEMENT LADDER ════════════ */
var RUNG_DESC = ['“Don’t log PII.” Easy to write, easy to ignore.', 'A human reads the design.', 'A linter or scanner flags it.', 'The diff is blocked if a sensitive column loses its policy.', 'Enforced in production on every request (purpose checks, tokens, mTLS).', 'Daily scans: new joins, access spikes, TTL drift.'];
V['assurance/controls'] = { title: 'Enforcement Ladder', render: function (s, q) {
  var dom = q.d || 'all', cs = NS.controls.filter(function (c) { return dom === 'all' || c.domain === dom; });
  var domains = P.uniq(NS.controls.map(function (c) { return c.domain; }));
  var ladder = P.LEVELS.map(function (l, i) {
    var here = cs.filter(function (c) { return c.level === i; });
    return '<div class="rung" style="--stair:' + ((5 - i) * 26) + 'px;' + (i === 0 ? 'border-color:rgba(192,71,15,.45)' : i >= 4 ? 'border-color:rgba(11,125,96,.35)' : '') + '"><div class="rn">L' + i + '</div><div class="rt">' + l + '</div><div class="rd">' + RUNG_DESC[i] + '</div><div class="cnt ' + (i === 0 && here.length ? 'bad' : i >= 4 ? 'ok' : '') + '">' + here.length + '</div>' +
      here.map(function (c) { return '<button class="ctl-chip ' + c.health + '" data-ent="' + c.id + '">' + esc(c.name) + '<small>' + esc(c.domain) + ' · ' + c.health + '</small></button>'; }).join('') + '</div>';
  }).join('');
  var heat = '<div class="heat" style="grid-template-columns:minmax(110px,150px) repeat(6,minmax(0,1fr))"><span></span>' + P.LEVELS.map(function (l, i) { return '<span class="hh">L' + i + '</span>'; }).join('') + domains.map(function (d) { var on = dom === d; return '<span class="hr' + (on ? ' on' : '') + '">' + esc(d) + '</span>' + P.LEVELS.map(function (l, i) { var n = NS.controls.filter(function (c) { return c.domain === d && c.level === i; }).length; return '<button class="hc' + (on ? ' on' : '') + '" aria-label="' + esc(d + ' L' + i + ': ' + n) + '" data-go="assurance/controls?d=' + encodeURIComponent(d) + '" style="background:' + (n ? (i === 0 ? 'rgba(192,71,15,.18)' : 'rgba(11,125,96,' + (0.08 + i * 0.05) + ')') : 'var(--panel)') + ';color:' + (n ? (i === 0 ? 'var(--exp)' : 'var(--ctl)') : 'var(--muted)') + ';font-weight:700">' + (n || '') + '</button>'; }).join(''); }).join('') + '</div>';
  var n = cs.length, byL = P.LEVELS.map(function (l, i) { return cs.filter(function (c) { return c.level === i; }).length; });
  return P.pageHead('Assurance', 'Privacy control enforcement ladder', 'Move privacy from documents into machines. Every rung up is harder to build and harder to bypass. Rule of thumb: every hard gate should trace back to a real postmortem.') +
    '<div class="stat-row card" style="margin-bottom:14px">' + [['Only in documents', byL[0], 'bad'], ['Human-enforced', byL[1], ''], ['Static checks', byL[2], ''], ['Deployment gates', byL[3], ''], ['Runtime', byL[4], 'ok'], ['Continuously audited', byL[5], 'ok'], ['Machine-enforced', P.pct(byL[2] + byL[3] + byL[4] + byL[5], n) + '%', ''], ['Failing', cs.filter(function (c) { return c.health === 'failing'; }).length, 'bad']].map(function (x) { return '<div class="stat"><div class="sv ' + x[2] + '">' + x[1] + '</div><div class="sl">' + x[0] + '</div></div>'; }).join('') + '</div>' +
    '<div class="toolbar"><div class="seg" role="group" aria-label="Domain" style="flex-wrap:wrap"><button data-go="assurance/controls" aria-pressed="' + (dom === 'all') + '">All</button>' + domains.map(function (d) { return '<button data-go="assurance/controls?d=' + encodeURIComponent(d) + '" aria-pressed="' + (dom === d) + '">' + esc(d) + '</button>'; }).join('') + '</div></div>' +
    '<div class="ladder" style="margin-bottom:10px">' + ladder + '</div><div class="callout" style="margin-bottom:14px"><b>The gap: pre-deploy ≠ runtime.</b> A deployment gate proves the design was checked. Only rungs 4–5 prove what happens in production.</div>' +
    '<div class="card"><div class="card-h"><h2 class="sec">Enforcement by domain</h2><span class="sub">where privacy still lives on paper</span></div>' + heat + '</div>';
} };

/* ════════════ AUDITS ════════════ */
V['assurance/audits'] = { title: 'Audits', render: function () {
  var T = NS.assumptionTests;
  var ds = NS.datasets.slice().sort(function (a, b) { return (P.daysSince(b.lastAudit) == null ? 9999 : P.daysSince(b.lastAudit)) - (P.daysSince(a.lastAudit) == null ? 9999 : P.daysSince(a.lastAudit)); });
  return P.pageHead('Assurance · the auditor', 'Verify what actually happens', 'Privacy bugs are usually assumption bugs. SPEC (what should happen) ≠ IMPLEMENTATION (what happens) ≠ ABUSE / EDGE (what else can happen). Test these every time.') +
    '<div class="grid g4" style="margin-bottom:14px">' + T.map(function (t) { return '<button class="card" data-ent="' + esc(t.ent) + '" style="text-align:left;cursor:pointer;border-color:' + (t.result === 'fail' ? 'rgba(192,71,15,.45)' : t.result === 'unknown' ? 'rgba(99,70,201,.45)' : 'rgba(11,125,96,.35)') + (t.result === 'unknown' ? ';border-style:dashed' : '') + '"><div class="card-h" style="margin-bottom:4px"><b>' + esc(t.k) + '</b><span class="tag ' + (t.result === 'fail' ? 'sev-HIGH' : t.result === 'unknown' ? 'k-UNKNOWN' : 'sev-GOOD') + '">' + t.result.toUpperCase() + '</span></div><div class="small dim">' + esc(t.q) + '</div><div class="small" style="margin-top:6px">' + esc(t.where) + '</div></button>'; }).join('') + '</div>' +
    '<div class="card" style="margin-bottom:14px"><div class="card-h"><h2 class="sec">Replay it as a story</h2><span class="sub">each assumption, step by step in the essay: how it fails, and the habits that prevent it</span></div><div class="fx" style="flex-wrap:wrap;gap:8px">' + T.filter(function (t) { return t.essay; }).map(function (t) { return '<a class="chip" href="../articles/every-arrow-is-a-decision.html#' + esc(t.essay) + '">' + esc(t.k) + ' &rarr;</a>'; }).join('') + '</div></div>' +
    '<div class="card"><div class="card-h"><h2 class="sec">Evidence freshness — last audit per dataset</h2><span class="sub">older than a year, or never, is a finding</span></div><div class="bars">' + ds.map(function (d) { var a = P.daysSince(d.lastAudit); return '<div class="br"><span>' + chip(d.id) + '</span><span class="track"><span class="fill" style="width:' + (a == null ? 100 : Math.min(100, a / 400 * 100)) + '%;background:' + (a == null ? 'repeating-linear-gradient(90deg,var(--unk) 0 4px,transparent 4px 7px)' : a > 365 ? 'var(--exp)' : a > 180 ? 'var(--med)' : 'var(--ctl)') + '"></span></span><span class="mono small" style="text-align:right">' + (a == null ? '<span class="unknown">never</span>' : a + ' d') + '</span></div>'; }).join('') + '</div></div>';
} };

/* ════════════ ACCESS & INSIDER ════════════ */
V['assurance/access'] = { title: 'Access & Insider', render: function () {
  var ds = NS.datasets.filter(function (d) { return d.accessPeople != null; }).sort(function (a, b) { return b.accessPeople - a.accessPeople; });
  var max = ds[0].accessPeople;
  return P.pageHead('Assurance', 'Access & insider privacy', 'People with access, services with access, privileged and break-glass use, sensitive queries, exports, large joins and identity-resolution jobs. Encryption does not stop anyone the system decrypts for.') +
    '<div class="grid g-main"><div class="card"><div class="card-h"><h2 class="sec">Signals this week</h2><span class="sub">from sensitive-query monitoring</span></div><div class="feed">' + NS.accessEvents.map(function (e) { return '<div data-ent="' + esc(e.data) + '" role="button" tabindex="0"><span class="ft">' + esc(e.t.slice(5, 10)) + '<br>' + esc(e.t.slice(11)) + '</span><div><div class="fk bad">' + esc(e.flag) + '</div><div class="fx"><b class="mono small">' + esc(e.who) + '</b> <span class="dim small">' + esc(e.kind) + '</span> — ' + esc(e.what) + '</div></div></div>'; }).join('') + '</div></div>' +
    '<div class="card"><div class="card-h"><h2 class="sec">Who can read what</h2><span class="sub">people with access (log scale)</span></div><div class="bars">' + ds.map(function (d) { var w = Math.log10(d.accessPeople + 1) / Math.log10(max + 1) * 100; return '<div class="br"><span>' + chip(d.id) + '</span><span class="track"><span class="fill" style="width:' + w + '%;background:' + (d.accessPeople > 100 ? 'var(--exp)' : P.dsTier(d) >= 3 && d.accessPeople > 30 ? 'var(--med)' : 'var(--t1)') + '"></span></span><span class="mono small" style="text-align:right">' + d.accessPeople.toLocaleString() + '</span></div>'; }).join('') + NS.datasets.filter(function (d) { return d.accessPeople == null; }).map(function (d) { return '<div class="br"><span>' + chip(d.id) + '</span><span class="track" style="border:1px dashed var(--unk)"></span><span class="mono small unknown" style="text-align:right;border:0">unknown</span></div>'; }).join('') + '</div></div></div>';
} };

/* ════════════ INCIDENTS ════════════ */
V['assurance/incidents'] = { title: 'Incidents', render: function () {
  var by = function (st) { return NS.incidents.filter(function (i) { return i.status === st; }).length; }, open = NS.incidents.length - by('closed');
  return P.pageHead('Assurance', 'Privacy incident center', 'Incidents beyond security breaches: exposure, excess access, consent failure, purpose violation, tracking, retention, deletion, vendor misuse, identity linking, logging leaks, misdirected exports, model leakage. Every postmortem ends in one question: can this become a machine-checkable invariant?') +
    '<p class="small" style="margin:0 0 12px"><b>' + open + ' not closed</b> of ' + NS.incidents.length + ' (' + by('open') + ' open, ' + (open - by('open')) + ' remediating, ' + by('closed') + ' closed with a permanent guard).</p>' +
    NS.incidents.map(function (i) {
      return '<div class="card" style="margin-bottom:12px"><div class="card-h"><div><span class="mono small dim">' + i.id + ' · ' + esc(i.type) + '</span><h2 class="sec" style="margin-top:2px"><button class="chip" data-ent="' + i.id + '" style="font-size:14px;font-weight:650;color:var(--text)">' + esc(i.title) + '</button></h2></div><div class="small"><span class="tag ' + (i.status === 'closed' ? 'sev-GOOD' : i.status === 'open' ? 'sev-HIGH' : 'sev-MEDIUM') + '">' + esc(i.status) + '</span> <span class="mono dim">' + esc(i.sev) + ' · ' + fmtN(i.people) + ' people · ' + esc(i.opened) + '</span></div></div><div class="chain">' +
        [['Failed assumption', i.assumption, 'bad'], ['Control gap', i.gap, 'bad'], ['Root cause', i.root, ''], ['Remediation', i.remediation, ''], ['Permanent guard', i.guard, 'good']].map(function (x) { return '<div class="cn ' + x[2] + '"><div class="cl">' + x[0] + '</div><div class="cv">' + esc(x[1]) + '</div></div>'; }).join('') + '</div></div>';
    }).join('');
} };

/* ════════════ DRIFT ════════════ */
V['assurance/drift'] = { title: 'Drift', render: function () {
  var types = P.uniq(NS.drift.map(function (d) { return d.type; })), wk = P.metric('drift').items().length;
  return P.pageHead('Assurance', 'Privacy drift feed', 'Privacy changes after launch. New fields, identifiers, joins, SDKs, vendors, regions, purposes, consumers and models; changed retention, broader access, permission and consent changes — each with a before/after diff.') +
    '<p class="small" style="margin:0 0 10px"><b>' + wk + ' changes this week need attention</b> (last 7 days, not marked good). All ' + NS.drift.length + ' changes are listed below, newest first.</p>' +
    '<div class="chips" style="margin-bottom:14px">' + types.map(function (t) { var n = NS.drift.filter(function (d) { return d.type === t; }).length; return '<span class="tag">' + esc(t) + ' · ' + n + '</span>'; }).join('') + '</div>' +
    '<div class="drift-list">' + NS.drift.map(function (d) {
      return '<div class="card flat" style="margin-bottom:10px;border-left:3px solid ' + (d.sev === 'HIGH' ? 'var(--exp)' : d.sev === 'GOOD' ? 'var(--ctl)' : d.sev === 'MEDIUM' ? 'var(--med)' : 'var(--line3)') + '"><div class="card-h" style="margin-bottom:6px"><div><span class="mono small dim">' + esc(d.t.replace('T', ' ')) + ' · ' + esc(d.type.toUpperCase()) + '</span><div style="font-weight:650;font-size:14.5px;margin-top:2px">' + esc(d.text) + '</div></div>' + P.sev(d.sev) + '</div><div class="diff"><div class="m">− ' + esc(d.before) + '</div><div class="p">+ ' + esc(d.after) + '</div></div><div class="chips" style="margin-top:8px">' + d.entities.map(function (e) { return chip(e); }).join('') + '</div></div>';
    }).join('') + '</div>';
} };

/* ════════════ EVIDENCE ════════════ */
V['assurance/evidence'] = { title: 'Evidence', render: function () {
  return P.pageHead('Assurance', 'Evidence locker', 'What proves each control works, and what produced each finding. A control with no evidence is an assertion.') +
    '<div class="tbl-wrap" style="margin-bottom:14px"><table class="tbl"><thead><tr><th>Control</th><th>Level</th><th>Health</th><th>Evidence</th><th>Owner</th></tr></thead><tbody>' + NS.controls.slice().sort(function (a, b) { return b.level - a.level; }).map(function (c) { return '<tr class="click" data-ent="' + c.id + '" tabindex="0"><td><b>' + esc(c.name) + '</b><div class="small dim">' + esc(c.domain) + ' · ' + esc(c.scope) + '</div></td><td>' + P.lvl(c.level) + '</td><td class="' + (c.health === 'working' ? 'ok' : c.health === 'failing' ? 'bad' : 'unknown') + '">' + c.health + '</td><td class="small">' + esc(c.evidence) + '</td><td class="small">' + esc(P.name(c.owner)) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Finding</th><th>Produced by</th><th>Opened</th></tr></thead><tbody>' + NS.findings.map(function (f) { return '<tr class="click" data-ent="' + f.id + '" tabindex="0"><td><span class="mono small">' + f.id + '</span> ' + esc(f.title) + '</td><td class="mono small">' + esc(f.detector) + '</td><td class="small">' + esc(f.opened) + '</td></tr>'; }).join('') + '</tbody></table></div>';
} };

/* ════════════ REGULATIONS ════════════ */
/* Scope of an obligation, counted from the graph: the dataset's system plus every system its flows touch. */
function SCOPE(o) {
  if (o.all === 'datasets') return 'all ' + NS.datasets.length + ' datasets';
  var d = P.get(o.data) && P.get(o.data).obj; if (!d) return unk('unknown');
  var sys = [d.system]; NS.flows.forEach(function (f) { if (f.from === d.system || f.to === d.system) sys.push(f.from === d.system ? f.to : f.from); });
  var n = P.uniq(sys).filter(function (id) { return P.get(id) && P.get(id).type === 'system'; }).length;
  return n + (n === 1 ? ' system holds or receives it' : ' systems hold or receive it');
}
V['governance/regulations'] = { title: 'Policies & Regulations', render: function () {
  return P.pageHead('Governance', 'Regulatory requirement mapper', 'Regulation or policy → obligation → data → systems → control → evidence. This translates obligations into system requirements. It is orientation, <b>not legal advice</b> — check current text and guidance for your jurisdiction.') +
    NS.regulations.map(function (r) {
      return '<div class="card" style="margin-bottom:12px"><div class="card-h"><h2 class="sec">' + chip(r.id) + '</h2><span class="sub">' + esc(r.scope) + '</span></div>' + r.obligations.map(function (o) {
        var ev = o.evidence ? P.get(o.evidence).obj : null;
        return '<div class="chain" style="margin-bottom:4px">' +
          '<div class="cn"><div class="cl">Obligation</div><div class="cv">' + esc(o.text) + '</div></div>' +
          '<div class="cn"><div class="cl">Data</div><div class="cv">' + chip(o.data) + '</div></div>' +
          '<div class="cn"><div class="cl">Scope</div><div class="cv">' + SCOPE(o) + '</div></div>' +
          '<div class="cn ' + (o.control ? '' : 'unk') + '"><div class="cl">Control</div><div class="cv">' + (o.control ? chip(o.control) + ' L' + P.get(o.control).obj.level : 'none') + '</div></div>' +
          '<div class="cn ' + (ev ? 'good' : 'unk') + '"><div class="cl">Evidence</div><div class="cv">' + (ev ? esc(ev.evidence) + (o.evidence !== o.control ? '<div class="small dim">from ' + esc(ev.name) + '</div>' : '') : 'none') + '</div></div>' +
          '<div class="cn ' + (o.status === 'met' ? 'good' : o.status === 'partial' ? 'warn' : o.status === 'unknown' ? 'unk' : 'bad') + '"><div class="cl">Status</div><div class="cv"><b>' + o.status.toUpperCase() + '</b> ' + esc(o.note) + '</div></div></div>';
      }).join('') + '</div>';
    }).join('');
} };

/* ════════════ VENDOR REGISTER ════════════ */
V['governance/vendors'] = { title: 'Vendor Register', render: function () {
  var I = P.vendorIssues().sort(function (a, b) { return b.issues.length - a.issues.length; });
  return P.pageHead('Governance', 'Vendor privacy register', 'For any partner integration, name the handshake pattern first — token, relay, proof, permission or aggregate — then the data, the retention and the contract. “None” means the partner receives the person.') +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vendor</th><th>Handshake</th><th>Tier</th><th class="num">People</th><th>Retention (contract / actual)</th><th>Contract</th><th>Deletion</th><th>Opt-out</th><th>Privacy review</th><th>Detections</th></tr></thead><tbody>' +
    I.map(function (x) { var v = x.v, hs = NS.handshakes[v.id]; return '<tr class="click" data-ent="' + v.id + '" tabindex="0"><td><b>' + esc(v.name) + '</b><div class="small dim">' + esc(v.role) + '</div></td><td><span class="tag ' + (hs === 'NONE' ? 'sev-HIGH' : 'sev-GOOD') + '">' + hs + '</span></td><td>' + P.tier(v.tier) + '</td><td class="num">' + fmtN(v.people) + '</td><td class="mono small">' + (v.retention.contract == null ? unk('unknown') : P.fmtDays(v.retention.contract)) + ' / ' + (v.retention.actual == null ? unk('unknown') : P.fmtDays(v.retention.actual)) + '</td><td class="small nowrap">' + (v.contract ? esc(v.contract.expires) : unk('none')) + '</td><td>' + (v.deletionApi ? '<span class="ok">API</span>' : '<span class="bad">none</span>') + '</td><td>' + (v.optOutPropagates ? '<span class="ok">yes</span>' : '<span class="bad">no</span>') + '</td><td class="small nowrap">' + (v.privacyReview ? (P.daysSince(v.privacyReview) > 365 ? '<span class="bad">' + esc(v.privacyReview) + '<br>over a year ago</span>' : esc(v.privacyReview)) : unk('never')) + '</td><td class="small det">' + (x.issues.length ? x.issues.map(function (i) { return '<span class="tag ' + (/unknown/.test(i) ? 'k-UNKNOWN' : 'sev-HIGH') + '" style="margin:1px">' + esc(i) + '</span>'; }).join(' ') : '<span class="ok">none</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
} };

/* ════════════ MATURITY ════════════ */
V['governance/maturity'] = { title: 'Maturity', render: function () {
  var L = NS.maturityLevels;
  return P.pageHead('Governance', 'Privacy maturity', 'Not one childish number. ' + NS.maturity.length + ' capabilities, each placed on a five-step scale from ad hoc to verifiable, with the reason.') +
    '<div class="tbl-wrap"><table class="tbl mat"><thead><tr><th>Capability</th>' + L.map(function (l) { return '<th>' + l + '</th>'; }).join('') + '<th>Why this level</th></tr></thead><tbody>' + NS.maturity.map(function (m) { return '<tr><td><b>' + esc(m[0]) + '</b><span class="mlvl">' + (m[1] + 1) + ' of ' + L.length + ' · ' + esc(L[m[1]]) + '</span></td>' + L.map(function (l, i) { return '<td class="mc">' + (i < m[1] ? '<i class="past"></i>' : i === m[1] ? '<i class="now" title="' + l + '"></i><span class="sr-only">current level: ' + l + '</span>' : '<i></i>') + '</td>'; }).join('') + '<td class="small muted">' + esc(m[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<div class="card" style="margin-top:14px"><h2 class="sec" style="margin-bottom:10px">Questions that reveal a team’s privacy maturity</h2><ol style="margin:0;padding-left:18px">' + ['When does privacy engineering enter product development — shaping designs, or cleaning up after them?', 'How often does a privacy finding change the architecture?', 'Which controls are enforced by code, and which live in documents?', 'Where does the team most often disagree with product or engineering?', 'What privacy promise would you refuse to break, even for a launch date?'].map(function (q) { return '<li style="margin:4px 0">' + esc(q) + '</li>'; }).join('') + '</ol></div>' +
    '<style>.mat td.mc{text-align:center}.mat td.mc i{display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid var(--line3)}.mat td.mc i.past{background:rgba(11,125,96,.35);border-color:transparent}.mat td.mc i.now{background:var(--ctl);box-shadow:0 0 0 4px rgba(11,125,96,.18);border-color:var(--ctl)}</style>';
} };

/* ════════════ REPORTS ════════════ */
/* Numbers in memos are read from the graph (d = the risk's asset); only judgement is typed. */
var KEPT = function (d) { return P.fmtDays(d.retention.actual) || 'an undeclared period'; };
var MEMO = {
  'R-01': { issue: function (d) { return 'Customer location history is kept ' + KEPT(d) + ' against a ' + P.fmtDays(d.retention.required) + ' need, readable by ' + d.accessServices + ' services, and flows into advertising audiences.'; }, like: 'Misuse already observed (ads). Breach likelihood moderate; regulatory scrutiny high (sensitive PI).', cons: 'Where people sleep and work, available to anyone who compromises one store — and already shaping ads they never agreed to.',
    opts: [['A · Enforce a 30-day TTL and block the ads read', '−70% records; removes the secondary use', 'None visible to customers', '1 eng-week'], ['B · Store only the chosen pickup point, not coordinates', '−95%; no movement history exists', 'Loses “recent locations” shortcut', '3 eng-weeks'], ['C · Compute nearest pickup on the device', '−100% server-side location', 'Same experience; slower cold start', 'One quarter']], rec: 'A this week; B next sprint; C on the roadmap.', resid: 'Home/work inference remains possible from shipping addresses (separate, lower risk).' },
  'R-02': { issue: function (d) { return 'An unowned identity-resolution job links health-app IDs to advertising IDs for ' + fmtN(d.people) + ' people with no declared purpose.'; }, like: 'Linkage is happening now; any analyst with warehouse access can query it.', cons: 'Health behaviour can alter an advertising profile. A logged-out “anonymous” device becomes named.',
    opts: [['A · Freeze the job and block purpose-scoped IDs', 'Stops new cross-context joins', 'Unified customer view paused', '2 eng-days'], ['B · Assign an owner, declare purposes per edge, delete edges older than need', 'Removes most of the graph', 'Marketing match rates drop', '3 eng-weeks'], ['C · Shut it down', 'Removes the exposure', 'No unified view', '1 eng-week']], rec: 'A today; then B with a named owner, or C if no one will own it.', resid: 'Existing downstream copies in the ads warehouse must be purged separately.' },
  'R-03': { issue: 'Fraud signals — device fingerprint and risk band — are consumed by the Marketing Audience Builder and exported to an ad partner.', like: function (d, r) { var dates = r.findings.map(function (f) { return P.get(f).obj.opened; }).concat(NS.accessEvents.filter(function (e) { return e.data === d.id; }).map(function (e) { return e.t.slice(0, 10); })).sort(); return 'Happening since at least ' + dates[0] + ' (earliest evidence); approved by a human as “analytics”.'; }, cons: 'People flagged as risky can be excluded from offers, or targeted differently, by advertisers who never see why.',
    opts: [['A · Remove the advertising consumer', 'Ends the secondary use', 'Lookalike model loses one feature', '2 eng-days'], ['B · Fraud-scoped identifier + runtime purpose enforcement at the feature store', 'Makes the drift impossible, not just forbidden', 'None', '4 eng-weeks'], ['C · Aggregate fraud bands before any non-fraud read', 'Reduces linkability', 'Coarser marketing signal', '2 eng-weeks']], rec: 'A now, B this quarter.', resid: 'Existing exports at AdReach: request deletion with attestation.' },
  'R-04': { issue: function (d) { return 'Assistant prompts and outputs are logged in full for ' + KEPT(d) + ', readable by ' + d.accessPeople + ' staff, and were added to a training set.'; }, like: 'Exposure is continuous; a breach of the log store is the likeliest path.', cons: 'What people confide to an assistant — symptoms, money, relationships — becomes a record and a training example.',
    opts: [['A · 30-day TTL + redact before logging', '−90% stored prompts', 'Less debugging history', '2 eng-weeks'], ['B · Separate opt-in for training; memorisation tests', 'Restores purpose limitation', 'Smaller fine-tune set', '1 month'], ['C · Stateless serving (no prompt retention)', 'Nothing to breach', 'Harder quality evaluation', 'One quarter']], rec: 'A and B now; evaluate C.', resid: function () { var v = P.get('v_lumen').obj; return v.name + ' keeps a ' + P.fmtDays(v.retention.contract) + ' abuse window by contract.'; } },
  'R-05': { issue: function () { var v = P.get('v_clearsight').obj; return 'Full browsing URLs with account IDs go to an analytics vendor that keeps them ' + P.fmtDays(v.retention.actual) + ' against a ' + P.fmtDays(v.retention.contract) + ' contract, and cannot delete.'; }, like: 'Continuous; vendor retention already exceeds contract.', cons: 'A browsing history — clinics, lawyers, job boards — tied to a named account, held by a third party.',
    opts: [['A · Strip query strings, drop account ID', 'Removes identity and most sensitive detail', 'Per-user funnels lost', '1 eng-week'], ['B · Derive category on device; send daily counts', 'No URLs leave the device', 'Coarser analytics', '4 eng-weeks'], ['C · Stop the export', 'Removes the exposure', 'No extension analytics', '1 day']], rec: 'C until A ships; B next.', resid: function () { return P.fmtDays(P.get('v_clearsight').obj.retention.actual) + ' of historic URLs at the vendor with no deletion API.'; } }
};
V['report/executive'] = { title: 'Executive Report', render: function (s, q) {
  var rid = q.r && MEMO[q.r] ? q.r : null;
  if (!rid && q.f) { NS.risks.forEach(function (r) { if (!rid && r.findings.indexOf(q.f) >= 0 && MEMO[r.id]) rid = r.id; }); }
  rid = rid || 'R-01';
  var r = P.get(rid).obj, c = P.riskCalc(r), d = P.get(r.asset).obj, m = {};
  Object.keys(MEMO[rid]).forEach(function (k) { var v = MEMO[rid][k]; m[k] = typeof v === 'function' ? v(d, r) : v; });
  /* The decision is due when the most urgent finding behind it is due. */
  var dues = r.findings.map(function (f) { return P.get(f) && P.get(f).obj.due; }).filter(Boolean).sort();
  var memo = '<div class="memo"><div class="mh">Privacy decision memo · Northstar (synthetic) · ' + esc(NS.TODAY) + '</div><h2>' + esc(r.name) + ': decision needed</h2>' +
    '<div class="mh">Issue</div><p style="margin:0">' + esc(m.issue) + '</p>' +
    '<table style="margin-top:12px"><tr><th>People affected</th><th>Data</th><th>Exposure</th><th>Scale</th></tr><tr><td>' + fmtN(d.people) + ' ' + esc(d.subjects.toLowerCase()) + '</td><td>' + esc(d.fields.filter(function (f) { return f[1] >= 3; }).map(function (f) { return f[0]; }).join(', ') || d.fields.map(function (f) { return f[0]; }).slice(0, 4).join(', ')) + '</td><td>Residual risk ' + c.residual + ' (' + c.rating + ')</td><td>' + d.accessPeople + ' people, ' + d.accessServices + ' services</td></tr></table>' +
    '<div class="mh">Likelihood</div><p style="margin:0">' + esc(m.like) + '</p><div class="mh">Customer consequence</div><p style="margin:0">' + esc(m.cons) + '</p>' +
    '<div class="mh">Options</div><table><tr><th>Option</th><th>Privacy reduction</th><th>Product impact</th><th>Engineering cost</th></tr>' + m.opts.map(function (o) { return '<tr><td><b>' + esc(o[0]) + '</b></td><td>' + esc(o[1]) + '</td><td>' + esc(o[2]) + '</td><td>' + esc(o[3]) + '</td></tr>'; }).join('') + '</table>' +
    '<div class="mh">Residual risk</div><p style="margin:0">' + esc(m.resid) + '</p><div class="mh">Recommendation</div><p style="margin:0"><b>' + esc(m.rec) + '</b></p>' +
    '<div class="dec">DECISION REQUIRED by ' + (dues.length ? esc(dues[0]) : unk('no due date set')) + ' — owner: ' + (d.owner ? esc(P.name(d.owner)) : unk('UNASSIGNED')) + '</div>' +
    '<div class="src">Evidence: ' + [r.asset].concat(r.findings).join(' · ') + ' · generated from the privacy graph; option costs are estimates from the owning team.</div></div>';
  return P.pageHead('Report', 'Executive privacy memo', 'Executives receive trade-offs, not schema diagrams: issue, people, data, exposure, scale, likelihood, consequence, options, residual risk, recommendation, decision.') +
    '<div class="toolbar"><div class="seg" role="group" aria-label="Risk">' + Object.keys(MEMO).map(function (k) { return '<button data-go="report/executive?r=' + k + '" aria-pressed="' + (k === rid) + '">' + esc(P.get(k).obj.name) + '</button>'; }).join('') + '</div><button class="btn" data-act="printMemo">Print</button></div>' + memo;
} };
P.acts.printMemo = function () { window.print(); };
V['report/engineering'] = { title: 'Engineering Report', render: function () {
  var byT = {}; P.openFindings().forEach(function (f) { (byT[f.owner || '__none'] = byT[f.owner || '__none'] || []).push(f); });
  return P.pageHead('Report', 'Engineering report', 'Open findings by owning team, with the enforcement level each fix must reach. Sorted by the team carrying the most HIGH findings.') +
    Object.keys(byT).sort(function (a, b) { var h = function (k) { return byT[k].filter(function (f) { return f.sev === 'HIGH'; }).length; }; return h(b) - h(a); }).map(function (t) {
      return '<div class="card" style="margin-bottom:12px"><div class="card-h"><h2 class="sec">' + (t === '__none' ? unk('NO OWNER') : chip(t)) + '</h2><span class="sub">' + byT[t].length + ' open</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Finding</th><th>Sev</th><th>Due</th><th>Must reach</th><th>First step</th></tr></thead><tbody>' + byT[t].map(function (f) { var du = P.daysUntil(f.due); return '<tr class="click" data-ent="' + f.id + '" tabindex="0"><td><span class="mono small">' + f.id + '</span> ' + esc(f.title) + '</td><td>' + P.sev(f.sev) + '</td><td class="small ' + (du != null && du < 7 ? 'bad' : '') + '">' + (f.due ? esc(f.due) : unk('no due date')) + '</td><td>' + (f.enforcement ? P.lvl(f.enforcement) : unk('target not set')) + '</td><td class="small">' + esc(f.mitigations[0]) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    }).join('');
} };
V['report/audit'] = { title: 'Audit Report', render: function () {
  var T = NS.deletionTargets, cs = NS.consentConsumers, pd = P.personalDatasets();
  var rows = [
    ['Personal datasets with an accountable owner', P.pct(pd.filter(function (d) { return d.owner; }).length, pd.length) + '%'],
    ['Sensitive data with an owner', P.pct(NS.datasets.filter(function (d) { return P.dsTier(d) >= 3 && d.owner; }).length, NS.datasets.filter(function (d) { return P.dsTier(d) >= 3; }).length) + '%'],
    ['Datasets with purpose tags', P.pct(NS.datasets.filter(function (d) { return d.purposes.length; }).length, NS.datasets.length) + '%'],
    ['Datasets with enforced TTL', P.pct(NS.datasets.filter(function (d) { return d.retention.ttl; }).length, NS.datasets.length) + '%'],
    ['Datasets kept longer than required', P.pct(P.metric('retviol').items().length, NS.datasets.length) + '%'],
    ['Systems supporting verified deletion', P.pct(T.filter(function (t) { return t[3] === 'verified'; }).length, T.length) + '%'],
    ['Consent checked at read time', P.pct(cs.filter(function (c) { return c.mode === 'read-time'; }).length, cs.length) + '%'],
    ['Third-party flows reviewed', P.pct(NS.flows.filter(function (f) { return f.boundary === 'third_party' && f.status === 'reviewed'; }).length, NS.flows.filter(function (f) { return f.boundary === 'third_party'; }).length) + '%'],
    ['SDKs inventoried and reviewed', P.pct(NS.trackers.filter(function (t) { return t.review === 'reviewed'; }).length, NS.trackers.length) + '%'],
    ['Controls machine-enforced (L2+)', P.pct(NS.controls.filter(function (c) { return c.level >= 2; }).length, NS.controls.length) + '%'],
    ['Runtime privacy controls (L4+)', P.pct(NS.controls.filter(function (c) { return c.level >= 4; }).length, NS.controls.length) + '%'],
    ['Models with documented provenance', P.pct(NS.models.filter(function (m) { return m.provenance === 'documented'; }).length, NS.models.length) + '%'],
    ['Open high-risk findings', P.metric('highfind').items().length],
    ['Median remediation age (open findings)', Math.round(P.quantile(P.openFindings().map(function (f) { return P.daysSince(f.opened); }), 0.5)) + ' d'],
    ['Identity-linkage exposures (unsanctioned joins)', NS.idJoins.filter(function (j) { return !j[4]; }).length],
    ['DP budget remaining (Insights)', 'ε ' + (NS.dp.total - NS.dp.releases.reduce(function (s, r) { return s + r.eps; }, 0)).toFixed(1) + ' of ' + NS.dp.total]
  ];
  return P.pageHead('Report', 'Audit report — operational privacy metrics', 'Metrics that describe what the systems do, not how many meetings were held. Every figure is computed from the graph at render time.') +
    '<div class="tbl-wrap"><table class="tbl"><tbody>' + rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td class="num"><b>' + r[1] + '</b></td></tr>'; }).join('') + '</tbody></table></div>' +
    '<p class="small dim" style="margin-top:10px">Deliberately absent: employees trained, policies published, privacy meetings held. They are context, not evidence.</p>';
} };
V['report/legal'] = { title: 'Privacy / Legal Report', render: function () {
  var all = []; NS.regulations.forEach(function (r) { r.obligations.forEach(function (o) { all.push([r, o]); }); });
  var gaps = all.filter(function (x) { return x[1].status !== 'met'; });
  return P.pageHead('Report', 'Privacy / legal report', 'Obligations mapped to systems, with the gaps engineering must close. Orientation only — not legal advice.') +
    '<div class="stat-row card" style="margin-bottom:14px"><div class="stat"><div class="sv">' + all.length + '</div><div class="sl">mapped obligations</div></div><div class="stat"><div class="sv ok">' + all.filter(function (x) { return x[1].status === 'met'; }).length + '</div><div class="sl">met with evidence</div></div><div class="stat"><div class="sv warn">' + all.filter(function (x) { return x[1].status === 'partial'; }).length + '</div><div class="sl">partial</div></div><div class="stat"><div class="sv bad">' + all.filter(function (x) { return x[1].status === 'gap'; }).length + '</div><div class="sl">gaps</div></div><div class="stat"><div class="sv unknown">' + all.filter(function (x) { return x[1].status === 'unknown'; }).length + '</div><div class="sl">unknown</div></div></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Regime</th><th>Obligation</th><th>Data</th><th>Gap</th><th>Status</th></tr></thead><tbody>' + gaps.map(function (x) { return '<tr><td>' + chip(x[0].id) + '</td><td>' + esc(x[1].text) + '</td><td>' + chip(x[1].data) + '</td><td class="small">' + (x[1].note ? esc(x[1].note) : unk('gap not described')) + '</td><td><span class="tag ' + (x[1].status === 'gap' ? 'sev-HIGH' : x[1].status === 'unknown' ? 'k-UNKNOWN' : 'sev-MEDIUM') + '">' + x[1].status + '</span></td></tr>'; }).join('') + '</tbody></table></div>';
} };
})();
