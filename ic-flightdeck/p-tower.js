'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   AGENT CONTROL TOWER — the AI platform's cockpit.
   The IC deck runs one person's agents. This runs the fleet: are our
   human + agent workflows delivering safely, efficiently and on time?
   ═══════════════════════════════════════════════════════════════════════ */

const TW_HERO = [
  {v:'14,281', l:'Agent jobs today',      tone:'ai',   d:'+12% vs yesterday', dd:'up',  spark:[9100,10400,11200,12600,12750,14281], ico:'agents'},
  {v:'1,824',  l:'Active agents',         tone:'info', d:'across 38 teams',   dd:'neu', spark:[1210,1380,1490,1640,1720,1824], ico:'code'},
  {v:'96.7%',  l:'Success rate',          tone:'good', d:'+0.4 pts',          dd:'up',  spark:[94.1,94.8,95.4,96.0,96.3,96.7], ico:'impact'},
  {v:'143',    l:'Approvals waiting',     tone:'warn', d:'31 over 4 h',       dd:'bad', spark:[88,96,104,118,131,143], ico:'blockers'},
  {v:'28',     l:'Failed workflows',      tone:'ser',  d:'−9 vs yesterday',   dd:'up',  spark:[61,54,48,41,37,28], ico:'incidents'},
  {v:'$34.8k', l:'AI spend today',        tone:'neutral', d:'of $48k daily cap', dd:'neu', spark:[21,24,27,30,32,34.8], ico:'budget'},
  {v:'$118k',  l:'Capacity returned',     tone:'good', d:'≈2,340 hours',      dd:'up',  spark:[62,74,86,97,108,118], ico:'career'}
];

const TW_AGENTS = [
  {n:'Coding Agent',        jobs:4120, ok:95.2, lat:'6.1 s', sp:9840, tier:'code',  auto:2, tools:14},
  {n:'Research Agent',      jobs:1980, ok:98.1, lat:'11.4 s',sp:6210, tier:'high',  auto:2, tools:9},
  {n:'Jira Agent',          jobs:2740, ok:99.4, lat:'1.8 s', sp:410,  tier:'fast',  auto:3, tools:6},
  {n:'Data Agent',          jobs:1210, ok:97.6, lat:'9.2 s', sp:4180, tier:'high',  auto:2, tools:11},
  {n:'Meeting Agent',       jobs:1640, ok:99.1, lat:'3.4 s', sp:720,  tier:'fast',  auto:3, tools:4},
  {n:'Documentation Agent', jobs:880,  ok:96.8, lat:'8.7 s', sp:3120, tier:'high',  auto:1, tools:7},
  {n:'Testing Agent',       jobs:960,  ok:88.4, lat:'14.2 s',sp:2960, tier:'code',  auto:2, tools:10},
  {n:'Incident Agent',      jobs:310,  ok:94.2, lat:'7.9 s', sp:1840, tier:'high',  auto:1, tools:12},
  {n:'Security Agent',      jobs:180,  ok:99.4, lat:'5.2 s', sp:1490, tier:'ent',   auto:0, tools:8},
  {n:'Learning Agent',      jobs:140,  ok:98.6, lat:'2.9 s', sp:180,  tier:'fast',  auto:2, tools:3},
  {n:'Travel Agent',        jobs:76,   ok:97.4, lat:'4.1 s', sp:120,  tier:'fast',  auto:1, tools:5},
  {n:'Expense Agent',       jobs:45,   ok:100,  lat:'2.2 s', sp:62,   tier:'fast',  auto:1, tools:4}
];
const TW_TIER = {fast:{l:'Fast / inexpensive',tone:'neutral'}, high:{l:'Advanced reasoning',tone:'ai'},
                 code:{l:'Coding-specialized',tone:'info'}, ent:{l:'Approved enterprise only',tone:'crit'}};

const TW_DAG = {
  nodes:[
    {id:'research', l:'Research Agent',      x:6,  y:12, st:'done'},
    {id:'code',     l:'Code Agent',          x:6,  y:44, st:'done'},
    {id:'data',     l:'Data Agent',          x:6,  y:76, st:'running'},
    {id:'arch',     l:'Architecture Agent',  x:35, y:44, st:'running'},
    {id:'doc',      l:'Documentation Agent', x:63, y:44, st:'queued'},
    {id:'human',    l:'HUMAN APPROVAL',      x:90, y:44, st:'waiting'}
  ],
  edges:[['research','arch'],['code','arch'],['data','arch'],['arch','doc'],['doc','human']]
};

const TW_WORKFLOWS = [
  {t:'Architecture review preparation', n:214, ok:97, lat:'18 m', st:'running', owner:'Engineering', tone:'info'},
  {t:'Release readiness sweep',        n:186, ok:94, lat:'26 m', st:'running', owner:'Release', tone:'info'},
  {t:'Incident correlation',           n:142, ok:91, lat:'4 m',  st:'running', owner:'SRE', tone:'warn'},
  {t:'Weekly brief generation',        n:980, ok:99, lat:'3 m',  st:'done',    owner:'All teams', tone:'good'},
  {t:'Test regeneration',              n:410, ok:88, lat:'31 m', st:'degraded',owner:'Engineering', tone:'ser'},
  {t:'Expense pre-fill',               n:264, ok:100,lat:'1 m',  st:'done',    owner:'Finance ops', tone:'good'},
  {t:'Onboarding pack assembly',       n:96,  ok:98, lat:'12 m', st:'queued',  owner:'People ops', tone:'neutral'}
];

const TW_APPROVALS = [
  {t:'Read production telemetry', n:38, age:'4 h 12 m', risk:'Data access', tone:'crit',
   why:'Agents verifying telemetry fields against the data policy before a release.'},
  {t:'Publish to Confluence', n:41, age:'2 h 30 m', risk:'Write to a system of record', tone:'warn',
   why:'Documentation agents have drafts ready; publishing is above their autonomy level.'},
  {t:'Comment on a customer ticket', n:24, age:'1 h 05 m', risk:'Customer communication', tone:'crit',
   why:'Support agents drafted replies. Customer-facing writes always require a human.'},
  {t:'Open a pull request', n:26, age:'48 m', risk:'Code change', tone:'warn',
   why:'Coding agents have branches ready. Merging is never delegated at any level.'},
  {t:'Grant temporary dataset access', n:14, age:'3 h 40 m', risk:'Access change', tone:'crit',
   why:'Access changes are Level-0 everywhere and always need a named human approver.'}
];

const TW_FAILURES = [
  {t:'Sandbox gateway 503', n:11, cause:'Environment', fix:'DX-771 open — not retried on purpose', tone:'warn'},
  {t:'File exceeds agent limit', n:6, cause:'Input size', fix:'Split the module first', tone:'neutral'},
  {t:'Tool timeout — metrics API', n:5, cause:'Upstream latency', fix:'Backoff raised; 2 retries', tone:'warn'},
  {t:'Schema drift in Jira export', n:3, cause:'Upstream change', fix:'Adapter updated this morning', tone:'good'},
  {t:'Model refusal — ambiguous scope', n:2, cause:'Prompt/scope', fix:'Routed to a human for clarification', tone:'info'},
  {t:'Budget guard triggered', n:1, cause:'Cost ceiling', fix:'Downgraded to the fast tier, completed', tone:'good'}
];

const TW_ROUTING = [
  {job:'Ticket sweeps, calendar reads, status rollups', tier:'fast', share:38, cost:0.004,
   why:'High volume, low ambiguity. Reasoning here would be waste.'},
  {job:'Architecture analysis, incident correlation, trade-offs', tier:'high', share:22, cost:0.21,
   why:'The value is the judgement; a cheap model produces confident nonsense.'},
  {job:'Repository inspection, test generation, diffing', tier:'code', share:34, cost:0.09,
   why:'Code-tuned models outperform general ones at the same cost.'},
  {job:'Anything touching production, HR, customer or payment data', tier:'ent', share:6, cost:0.28,
   why:'Confidential data never leaves the approved enterprise deployment.'}
];

const TW_COST = {
  today:34812, cap:48000, month:612400, monthCap:840000,
  trend:[21400,24100,27300,29800,32200,34812],
  perOutcome:[{t:'Cost per successful workflow', v:'$2.44'},{t:'Cost per hour returned', v:'$14.88'},
              {t:'Estimated capacity returned', v:'$118k/day'},{t:'Net position', v:'+$83k/day'}],
  byOrg:[{o:'Engineering', v:18400},{o:'Data', v:5900},{o:'Support', v:4100},
         {o:'Security', v:2600},{o:'Product', v:2200},{o:'Finance ops', v:1612}]
};

const TW_SECURITY = [
  {t:'Confidential routing violations', v:'0', tone:'good', d:'Enterprise-only routing held on every job today.'},
  {t:'Scope-widening attempts blocked', v:'17', tone:'warn', d:'Agents asked for permissions beyond their grant; all refused and logged.'},
  {t:'Prompt-injection attempts detected', v:'4', tone:'ser', d:'Three in fetched web content, one in a ticket body. All quarantined.'},
  {t:'Private Vault access attempts', v:'0', tone:'good', d:'No agent may read a Private Vault at any autonomy level.'},
  {t:'Data egress to unapproved models', v:'0', tone:'good', d:'Structurally impossible — the route does not exist.'},
  {t:'Actions taken without a required approval', v:'0', tone:'good', d:'Sensitive actions are gated in the runtime, not by prompt instruction.'}
];

const TW_POLICIES = [
  {t:'Sensitive actions always require a human', d:'Production changes, financial transactions, personal data, customer communication, access changes and legal or compliance actions — at every autonomy level.', tone:'crit'},
  {t:'No agent inherits a human’s full permissions', d:'An agent receives the narrowest scope for one job, time-boxed, and loses it when the job ends.', tone:'ai'},
  {t:'Confidential data is routed, not trusted', d:'Enterprise-only routing is enforced in the gateway. An agent cannot opt out, and neither can a prompt.', tone:'crit'},
  {t:'Budget ceilings degrade, they do not overspend', d:'At the ceiling, non-critical jobs drop to the inexpensive tier and the owner is told. Nothing silently exceeds a cap.', tone:'good'},
  {t:'Every job is attributable', d:'Agent, model, prompt hash, tools called, data read, cost and approver are recorded for every job and visible to the person it ran for.', tone:'info'},
  {t:'Agent output is never performance evidence', d:'What an agent did for someone is not a measure of that person, and is never exposed to a manager as individual telemetry.', tone:'ai'}
];

const TW_INSTRUMENTS = [
  {id:'twjobs', label:'Jobs Today', value:'14,281', tone:'ai', sub:'1,824 agents · 38 teams', go:'twmission', spark:[9.1,10.4,11.2,12.6,12.7,14.3],
   note:'Agent jobs started across the company today.'},
  {id:'twok',   label:'Success Rate', value:'96.7%', tone:'good', sub:'28 failures · 0 silent', go:'twfailures', spark:[94.1,94.8,95.4,96,96.3,96.7]},
  {id:'twappr', label:'Approvals Waiting', value:'143', tone:'warn', sub:'31 waiting over 4 hours', go:'twapprovals', spark:[88,96,104,118,131,143],
   note:'Agents paused for a human decision. Nothing proceeds without one.'},
  {id:'twfail', label:'Failed Workflows', value:'28', tone:'ser', sub:'11 environmental · 0 unexplained', go:'twfailures', spark:[61,54,48,41,37,28]},
  {id:'twcost', label:'Spend Today', value:'$34.8k', tone:'neutral', sub:'of $48k daily ceiling', go:'twcost', spark:[21,24,27,30,32,35]},
  {id:'twret',  label:'Capacity Returned', value:'$118k', tone:'good', sub:'≈2,340 hours today', go:'twcost', spark:[62,74,86,97,108,118]},
  {id:'twsec',  label:'Security Events', value:'21', tone:'warn', sub:'all blocked and logged', go:'twsecurity'},
  {id:'twlat',  label:'Median Latency', value:'6.4s', tone:'info', sub:'per job · p99 41 s', go:'twobs', spark:[8.1,7.6,7.2,6.9,6.6,6.4]}
];

/* ── views ──────────────────────────────────────────────────────────── */
function twDag(){
  const W=780,H=210,N={};
  TW_DAG.nodes.forEach(n=>N[n.id]={...n, px:(n.x/100)*(W-170)+80, py:(n.y/100)*(H-70)+35});
  return `<div class="dag-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Agent workflow graph">
    ${TW_DAG.edges.map(([a,b])=>{const s1=N[a],s2=N[b],mx=(s1.px+s2.px)/2, done=s1.st==='done';
      return `<path d="M${s1.px+58} ${s1.py} C${mx} ${s1.py}, ${mx} ${s2.py}, ${s2.px-58} ${s2.py}"
        fill="none" stroke="${done?HEX.good:'#dce0ee'}" stroke-width="${done?2:1.6}" ${done?'':'stroke-dasharray="5 4"'}/>`;}).join('')}
    ${TW_DAG.nodes.map(n=>{const t=ST_TONE[n.st], nn=N[n.id], isH=n.id==='human';
      return `<g><rect x="${nn.px-58}" y="${nn.py-20}" width="116" height="40" rx="10"
        fill="${isH?'#191b24':'#fff'}" stroke="${isH?'#191b24':HEX[t]}" stroke-width="1.6"/>
        <circle cx="${nn.px-42}" cy="${nn.py}" r="4" fill="${isH?'#ffd166':HEX[t]}"/>
        <text x="${nn.px+5}" y="${nn.py-1}" text-anchor="middle" font-size="9.5" font-weight="700"
          fill="${isH?'#fff':'#191b24'}" font-family="Inter,sans-serif">${esc(n.l)}</text>
        <text x="${nn.px+5}" y="${nn.py+11}" text-anchor="middle" font-size="8"
          fill="${isH?'#ffd166':'#666b7c'}" font-family="Inter,sans-serif">${esc(ST_LABEL[n.st])}</text></g>`;}).join('')}
  </svg></div>
  <div class="legend" style="margin-top:8px">
    ${['done','running','queued','waiting'].map(k=>`<span><i style="background:${HEX[ST_TONE[k]]}"></i> ${esc(ST_LABEL[k])}</span>`).join('')}
    <span style="margin-left:6px">Every workflow of this shape terminates at a human.</span></div>`;
}

function twvMission(){
  return `<div class="page-hd"><div><h1>Agent mission control</h1>
    <p>The fleet: 1,824 agents working for 38 teams, and where a human is needed.</p></div>
    <div class="ph-actions"><button class="btn sm" data-go="twpolicies">Policies</button></div></div>
  <div class="mrow">${TW_HERO.map((m,i)=>`<div class="mt" data-twhero="${i}">
    <div class="mt-top"><div class="ib sm ib-${m.tone==='neutral'?'neutral':m.tone}">${ic(m.ico,13)}</div>
      <span class="mt-d ${m.dd}">${esc(m.d)}</span></div>
    <div class="mt-v ${VTONE[m.tone]||''}">${esc(m.v)}</div>
    <div class="mt-l">${esc(m.l)}</div>
    <div class="mt-spark">${spark(m.spark,HEX[m.tone==='neutral'?'info':m.tone],150,24)}</div></div>`).join('')}</div>

  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>A workflow, end to end</h3><span class="chspacer"></span>
      <span class="tiny muted">most common shape today · 214 runs</span></div>
      <p class="card-sub">The Chief of Agents decomposes one human request into specialist work, then synthesises it back into one result.</p>
      ${twDag()}
      <div class="callout indigo" style="margin-top:13px">
        <div class="ib ib-ai">${ic('assistant',15)}</div>
        <div class="co-b"><div class="co-t">“Prepare me for the Phoenix architecture review Thursday.”</div>
        <div class="tiny">Six agents dispatched. The employee sees one mission and one decision — not six bots.</div></div></div>
    </div>
    <div class="card" style="border-top:3px solid ${HEX.warn}">
      <div class="card-hd"><div class="ib ib-warn">${ic('blockers',15)}</div><h3>Humans needed now</h3>
        <span class="chspacer"></span>${chip('143','warn')}</div>
      ${TW_APPROVALS.map(a=>`<div style="padding:9px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
          <span style="font-size:11.5px;font-weight:600">${esc(a.t)}</span>
          <b class="num ${a.tone==='crit'?'v-crit':'v-warn'}">${a.n}</b></div>
        <div class="tiny muted" style="margin-top:3px">oldest ${esc(a.age)} · ${esc(a.risk)}</div></div>`).join('')}
      <div class="btnrow" style="margin-top:11px"><button class="btn ai sm wide" data-go="twapprovals">Open approvals queue</button></div></div>
  </div>

  <div class="sec"><h2>Deadline intelligence</h2><p>Human work, agent work and external dependencies together</p></div>
  <div class="grid g3">
    ${[{t:'Release Friday',rem:12,lanes:[['You',3,HEX.ai],['AI agents',7,HEX.info],['Other teams',2,HEX.warn]],
        eta:'Thursday 4:20 PM',risk:'Security approval could add one day',act:'Escalate today',tone:'warn'},
       {t:'Phoenix launch Nov 5',rem:34,lanes:[['Teams',18,HEX.ai],['AI agents',12,HEX.info],['Vendors',4,HEX.warn]],
        eta:'Nov 3, 11:00 AM',risk:'Ingestion owner still unassigned',act:'Name an owner this week',tone:'ser'},
       {t:'Q3 close Sep 30',rem:9,lanes:[['Finance',4,HEX.ai],['AI agents',5,HEX.info]],
        eta:'Sep 29, 2:10 PM',risk:'None identified',act:'On track',tone:'good'}]
      .map(d=>`<div class="card" style="border-top:3px solid ${HEX[d.tone]}">
        <div class="card-hd"><h3>${esc(d.t)}</h3><span class="chspacer"></span>${chip(d.rem+' tasks',d.tone)}</div>
        <div class="stack" style="margin:10px 0 8px">
          ${d.lanes.map(([l,v,h])=>`<i style="width:${v/d.rem*100}%;background:${h}"></i>`).join('')}</div>
        <div class="legend" style="margin-bottom:10px">${d.lanes.map(([l,v,h])=>`<span><i style="background:${h}"></i> ${esc(l)} ${v}</span>`).join('')}</div>
        ${kv('Projected',`<span class="${d.tone==='good'?'v-good':''}">${esc(d.eta)}</span>`)}
        <div class="tiny muted" style="margin-top:8px;line-height:1.5"><strong>Risk.</strong> ${esc(d.risk)}</div>
        <div class="nextact" style="margin-top:9px"><div class="nal">Recommended</div><div class="nav-t">${esc(d.act)}</div></div>
      </div>`).join('')}
  </div>`;
}

function twvAgents(){
  return `<div class="page-hd"><div><h1>Agents</h1><p>Twelve specialist types across the fleet.</p></div></div>
  ${pulse([{v:'1,824',l:'active instances',tone:'info'},{v:'12',l:'agent types',tone:'neutral'},
           {v:'14,281',l:'jobs today',tone:'ai'},{v:'96.7%',l:'success',tone:'good'},
           {v:'$34.8k',l:'spend',tone:'neutral'}])}
  <div class="card"><div class="card-hd"><h3>Jobs and success by agent type</h3></div>
    <div class="chart-box"><canvas id="twch-agents"></canvas></div></div>
  <div class="tbl-wrap" style="margin-top:16px"><table class="tbl">
    <thead><tr><th>Agent</th><th>Model tier</th><th>Jobs</th><th>Success</th><th>Median latency</th>
      <th>Tools</th><th>Autonomy</th><th>Spend</th></tr></thead>
    <tbody>${TW_AGENTS.map(a=>`<tr>
      <td><strong>${esc(a.n)}</strong></td>
      <td>${chip(TW_TIER[a.tier].l,TW_TIER[a.tier].tone)}</td>
      <td class="r">${a.jobs.toLocaleString()}</td>
      <td class="r ${a.ok<90?'v-ser':a.ok<96?'v-warn':'v-good'}">${a.ok}%</td>
      <td class="r muted">${esc(a.lat)}</td><td class="r muted">${a.tools}</td>
      <td>${chip('L'+a.auto,a.auto===0?'crit':a.auto===3?'good':'ai')}</td>
      <td class="r">${money(a.sp)}</td></tr>`).join('')}</tbody></table></div>`;
}

function twvWorkflows(){
  return `<div class="page-hd"><div><h1>Workflows</h1><p>Named multi-agent missions, not individual jobs.</p></div></div>
  ${pulse([{v:'7',l:'workflow types',tone:'neutral'},{v:'2,292',l:'runs today',tone:'ai'},
           {v:'3',l:'running now',tone:'info'},{v:'1',l:'degraded',tone:'ser'}])}
  <div class="card" style="margin-bottom:16px"><div class="card-hd"><h3>Reference shape</h3></div>${twDag()}</div>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Workflow</th><th>Owner</th><th>Runs today</th><th>Success</th><th>Median duration</th><th>State</th></tr></thead>
    <tbody>${TW_WORKFLOWS.map(w=>`<tr>
      <td><strong>${esc(w.t)}</strong></td><td class="tiny muted">${esc(w.owner)}</td>
      <td class="r">${w.n}</td>
      <td class="r ${w.ok<90?'v-ser':'v-good'}">${w.ok}%</td>
      <td class="r muted">${esc(w.lat)}</td>
      <td>${chip(w.st,w.tone)}</td></tr>`).join('')}</tbody></table></div>`;
}

function twvApprovals(){
  const total = TW_APPROVALS.reduce((a,x)=>a+x.n,0);
  return `<div class="page-hd"><div><h1>Approvals</h1>
    <p>${total} agents paused for a human decision. None of them proceeds without one.</p></div></div>
  ${pulse([{v:String(total),l:'waiting',tone:'warn'},{v:'31',l:'over 4 hours',tone:'crit'},
           {v:'4 h 12 m',l:'oldest',tone:'crit'},{v:'0',l:'auto-approved',tone:'good'},
           {v:'892',l:'decided today',tone:'info'}])}
  ${TW_APPROVALS.map(a=>`<div class="approval" style="border-color:${a.tone==='crit'?'rgba(208,59,59,.4)':'rgba(250,178,25,.45)'}">
    <div class="approval-k" style="${a.tone==='crit'?'color:var(--crit-ink)':''}">${ic('blockers',11)} ${esc(a.risk)} · ${a.n} waiting</div>
    <h4>${esc(a.t)}</h4>
    <div class="aq">${esc(a.why)}</div>
    <div class="ascope"><b>Oldest in queue</b>${esc(a.age)}</div>
    <div class="btnrow" style="margin-top:12px">
      <button class="btn sm" data-twq="${esc(a.t)}">Review the queue</button>
      <button class="btn sm" data-go="twpolicies">Why this needs a human</button></div>
  </div>`).join('')}
  <div class="vault-band"><b>NEVER AUTO-GRANTED</b>
    <span>Approval volume is a workload problem to solve by scoping agents better — never by lowering the gate. No sensitive action is ever auto-approved because a queue is long.</span></div>`;
}

function twvFailures(){
  const total = TW_FAILURES.reduce((a,f)=>a+f.n,0);
  return `<div class="page-hd"><div><h1>Failures</h1>
    <p>${total} failed workflows today, every one with a named cause.</p></div></div>
  ${pulse([{v:String(total),l:'failed today',tone:'ser'},{v:'11',l:'environmental',tone:'warn'},
           {v:'0',l:'unexplained',tone:'good'},{v:'0',l:'silently retried',tone:'good'},
           {v:'−9',l:'vs yesterday',tone:'good'}])}
  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>Failures by cause</h3></div>
      <div class="chart-box sm"><canvas id="twch-fail"></canvas></div></div>
    <div class="card"><div class="card-hd"><h3>Trend</h3><span class="chspacer"></span>${chip('−54% in six days','good')}</div>
      <div style="padding:12px 0">${spark([61,54,48,41,37,28],HEX.good,460,88).replace('class="spark"','style="width:100%;height:88px"')}</div>
      <p class="tiny muted" style="line-height:1.55">Most of the improvement came from fixing the Jira schema adapter and raising the metrics-API backoff — not from retrying harder.</p></div>
  </div>
  <div class="sec"><h2>Every failure, with its cause</h2></div>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Failure</th><th>Count</th><th>Cause</th><th>Disposition</th></tr></thead>
    <tbody>${TW_FAILURES.map(f=>`<tr>
      <td><strong>${esc(f.t)}</strong></td><td class="r">${f.n}</td>
      <td>${chip(f.cause,f.tone)}</td><td class="tiny">${esc(f.fix)}</td></tr>`).join('')}</tbody></table></div>
  <div class="callout amber" style="margin-top:16px">
    <div class="ib ib-warn">${ic('assistant',15)}</div>
    <div class="co-b"><div class="co-t">“Flake” is not a cause.</div>
      <div class="tiny">A job is retried only when the environment failed before any work ran. Eleven sandbox failures today were left failed on purpose — the gateway is broken, and retrying would hide it.</div></div></div>`;
}

function twvModels(){
  return `<div class="page-hd"><div><h1>Model routing</h1>
    <p>The Chief of Agents picks the capability that fits the job — and the routing for confidential data is not negotiable.</p></div></div>
  ${pulse([{v:'4',l:'routing tiers',tone:'neutral'},{v:'38%',l:'on the cheap tier',tone:'good'},
           {v:'6%',l:'enterprise-only',tone:'crit'},{v:'$0.061',l:'blended cost per job',tone:'info'},
           {v:'0',l:'routing violations',tone:'good'}])}
  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>Job share by tier</h3></div>
      ${donut(TW_ROUTING.map(r=>({l:TW_TIER[r.tier].l, v:r.share, hex:HEX[TW_TIER[r.tier].tone==='neutral'?'neutral':TW_TIER[r.tier].tone]})),
              '38%','on fast tier',150)}</div>
    <div class="card"><div class="card-hd"><h3>Cost per job by tier</h3></div>
      <div class="chart-box sm"><canvas id="twch-route"></canvas></div>
      <p class="tiny muted" style="margin-top:10px;line-height:1.55">Routing 38% of volume to the inexpensive tier is what keeps the blended cost at six cents a job. Sending everything to the advanced model would cost roughly 3.4× more for no measurable gain on those jobs.</p></div>
  </div>
  <div class="sec"><h2>Routing rules</h2></div>
  <div class="card">${TW_ROUTING.map(r=>`<div class="route">
    <div><div class="route-j">${esc(r.job)}</div><div class="route-w">${esc(r.why)}</div></div>
    <div class="route-t">${chip(TW_TIER[r.tier].l,TW_TIER[r.tier].tone)}
      <div class="route-s"><i style="width:${r.share}%;background:${HEX[TW_TIER[r.tier].tone==='neutral'?'neutral':TW_TIER[r.tier].tone]}"></i></div>
      <div class="tiny muted" style="margin-top:4px">${r.share}% · $${r.cost.toFixed(3)}/job</div></div></div>`).join('')}
    <div class="vault-band" style="margin-top:14px"><b>HARD ROUTE</b>
      <span>Confidential data reaches the approved enterprise deployment and nothing else. The rule lives in the gateway, not in a prompt — so no agent, and no instruction inside any document an agent reads, can change it.</span></div></div>`;
}

function twvCost(){
  const C = TW_COST;
  return `<div class="page-hd"><div><h1>Cost</h1><p>What the fleet costs, and what it returns.</p></div></div>
  <div class="mrow">
    ${[{v:money(C.today),l:'spend today',s:'of '+money(C.cap)+' ceiling',tone:'neutral',ico:'budget'},
       {v:'$118k',l:'capacity returned today',s:'≈2,340 hours',tone:'good',ico:'career'},
       {v:'$2.44',l:'cost per successful workflow',s:'down from $3.10',tone:'good',ico:'impact'},
       {v:money(C.month),l:'month to date',s:'of '+money(C.monthCap)+' budget',tone:'info',ico:'okrs'}]
      .map(m=>`<div class="mt"><div class="mt-top"><div class="ib sm ib-${m.tone}">${ic(m.ico,13)}</div></div>
        <div class="mt-v ${VTONE[m.tone]||''}">${esc(m.v)}</div>
        <div class="mt-l">${esc(m.l)}</div><div class="mt-s">${esc(m.s)}</div></div>`).join('')}
  </div>
  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>Daily spend against the ceiling</h3></div>
      <div class="chart-box"><canvas id="twch-cost"></canvas></div>
      <p class="tiny muted" style="margin-top:10px;line-height:1.55">At the ceiling, non-critical jobs drop to the inexpensive tier and their owners are notified. The platform does not silently exceed a cap, and it does not silently stop working either.</p></div>
    <div class="card"><div class="card-hd"><h3>Return against spend</h3></div>
      ${C.perOutcome.map(x=>kv(x.t,`<span class="${x.t.includes('Net')?'v-good':''}">${esc(x.v)}</span>`)).join('')}
      <div class="card-hd" style="margin:16px 0 8px"><h3>Spend by organisation</h3></div>
      ${C.byOrg.map(o=>miniBar(o.o,o.v,18400,HEX.ai,'')).join('')}</div>
  </div>`;
}

function twvSecurity(){
  return `<div class="page-hd"><div><h1>Security</h1>
    <p>What agents tried to do that they were not allowed to do.</p></div></div>
  <div class="grid g3">${TW_SECURITY.map(x=>`<div class="card" style="border-top:3px solid ${HEX[x.tone]}">
    <div class="card-hd"><h3>${esc(x.t)}</h3></div>
    <div style="font-size:30px;font-weight:800;font-family:var(--mono);letter-spacing:-.05em;margin:8px 0 6px"
      class="${VTONE[x.tone]||''}">${esc(x.v)}</div>
    <p class="tiny" style="line-height:1.55">${esc(x.d)}</p></div>`).join('')}</div>
  <div class="sec"><h2>Why the zeros are structural</h2></div>
  <div class="card">
    <p class="card-sub" style="font-size:12.5px;line-height:1.7">The three zeros above are not good behaviour — they are routes that do not exist. An agent cannot read a Private Vault because the vault is a separate store with separate keys and no agent credential. Confidential data cannot reach an unapproved model because the gateway refuses the call. Sensitive actions cannot execute without approval because the runtime, not the prompt, holds the gate.</p>
    <p class="card-sub" style="font-size:12.5px;line-height:1.7;margin-top:11px">The seventeen blocked scope-widening attempts are the interesting number. Agents asking for more than they were granted is expected and healthy — what matters is that the answer was no, every time, and that it was logged for the person the job ran for.</p>
  </div>`;
}

function twvPermissions(){
  return `<div class="page-hd"><div><h1>Permissions</h1>
    <p>Autonomy is set per agent, and the ceiling is set by the action, not the agent.</p></div></div>
  <div class="grid g4">${AUTONOMY.map(a=>`<div class="card" style="border-top:3px solid ${HEX[a.tone]}">
    <div class="tile-l">Level ${a.lvl}</div>
    <div style="font-size:13px;font-weight:800;margin:6px 0 5px">${esc(a.n)}</div>
    <p class="tiny" style="line-height:1.5">${esc(a.d)}</p>
    <div class="tiny muted" style="margin-top:9px">${TW_AGENTS.filter(x=>x.auto===a.lvl).length} agent types</div>
  </div>`).join('')}</div>
  <div class="card" style="margin-top:16px;border-color:rgba(208,59,59,.28)">
    <div class="card-hd"><div class="ib ib-crit">${ic('vault',15)}</div><h3>Actions that always require a human</h3></div>
    <p class="card-sub">Regardless of the agent's autonomy level, these are gated in the runtime.</p>
    <div class="grid g2" style="margin-top:10px">
      ${['Production changes','Financial transactions','Personal data access','Customer communication',
         'Access and permission changes','Legal and compliance actions','Anything writing to a system of record',
         'Any read of a Private Vault — which is refused outright, not merely gated']
        .map(g=>`<div class="guard"><span class="gx">✕</span> ${esc(g)}</div>`).join('')}</div></div>
  <div class="sec"><h2>Autonomy by agent type</h2></div>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Agent</th><th>Autonomy</th><th>What that means</th><th>Tools granted</th></tr></thead>
    <tbody>${TW_AGENTS.map(a=>`<tr><td><strong>${esc(a.n)}</strong></td>
      <td>${chip('Level '+a.auto+' · '+AUTONOMY[a.auto].n, AUTONOMY[a.auto].tone)}</td>
      <td class="tiny muted">${esc(AUTONOMY[a.auto].d)}</td>
      <td class="r">${a.tools}</td></tr>`).join('')}</tbody></table></div>`;
}

function twvObs(){
  return `<div class="page-hd"><div><h1>Observability</h1><p>Every job is attributable.</p></div></div>
  ${pulse([{v:'6.4s',l:'median job latency',tone:'info'},{v:'41s',l:'p99 latency',tone:'warn'},
           {v:'184M',l:'tokens today',tone:'neutral'},{v:'61,400',l:'tool calls',tone:'ai'},
           {v:'1,240',l:'retries',tone:'warn'},{v:'0',l:'unattributed jobs',tone:'good'}])}
  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>Latency distribution</h3></div>
      <div class="chart-box"><canvas id="twch-lat"></canvas></div></div>
    <div class="card"><div class="card-hd"><h3>What is recorded per job</h3></div>
      ${[['Agent and workflow','identity and parent mission'],['Model and tier','plus why it was routed there'],
         ['Tokens in and out','and the cost they produced'],['Tools called','with arguments hashed, not stored'],
         ['Data sources read','at the scope that was granted'],['Approver','where a human was required'],
         ['Outcome','success, failure with cause, or refusal']]
        .map(([k,v])=>kv(k,`<span class="muted">${esc(v)}</span>`)).join('')}
      <div class="callout indigo" style="margin-top:13px">
        <div class="ib ib-ai">${ic('vault',15)}</div>
        <div class="co-b"><div class="co-t">Visible to the person it ran for</div>
        <div class="tiny">Job records are readable by the employee the job served. They are not exposed to that person's manager as individual telemetry.</div></div></div>
    </div>
  </div>`;
}

function twvPolicies(){
  return `<div class="page-hd"><div><h1>Policies</h1>
    <p>The rules the platform enforces, and where they are enforced.</p></div></div>
  <div class="grid g2">${TW_POLICIES.map(pl=>`<div class="card" style="border-left:3px solid ${HEX[pl.tone]}">
    <div class="card-hd"><div class="ib ib-${pl.tone}">${ic('vault',15)}</div><h3>${esc(pl.t)}</h3></div>
    <p class="card-sub" style="line-height:1.65;margin-top:6px">${esc(pl.d)}</p></div>`).join('')}</div>
  <div class="card" style="margin-top:16px">
    <div class="card-hd"><h3>Enforced in the runtime, not the prompt</h3></div>
    <p class="card-sub" style="font-size:12.5px;line-height:1.7">A policy written only into a system prompt is a request. Every rule above is enforced at the gateway or the permission broker, so it survives an agent that misbehaves, a prompt that argues, and a document that contains instructions aimed at the agent reading it.</p>
  </div>`;
}

/* ── charts ─────────────────────────────────────────────────────────── */
function twCharts(){
  if(typeof Chart === 'undefined') return;
  const mk=(id,cfg)=>{const el=document.getElementById(id); if(el) S.charts[id]=new Chart(el,cfg);};
  mk('twch-agents',{type:'bar',
    data:{labels:TW_AGENTS.map(a=>a.n.replace(' Agent','')), datasets:[{label:'Jobs today',
      data:TW_AGENTS.map(a=>a.jobs), backgroundColor:'#2a78d6', borderRadius:4, borderSkipped:false, maxBarThickness:26}]},
    options:(()=>{const o=clone(CH_BASE); o.plugins.legend.display=false; return o;})()});
  mk('twch-fail',{type:'bar',
    data:{labels:TW_FAILURES.map(f=>f.t), datasets:[{label:'Failures',
      data:TW_FAILURES.map(f=>f.n), backgroundColor:TW_FAILURES.map(f=>HEX[f.tone]),
      borderRadius:4, borderSkipped:false, maxBarThickness:24}]},
    options:(()=>{const o=clone(CH_BASE); o.indexAxis='y'; o.plugins.legend.display=false; return o;})()});
  mk('twch-route',{type:'bar',
    data:{labels:TW_ROUTING.map(r=>TW_TIER[r.tier].l), datasets:[{label:'Cost per job ($)',
      data:TW_ROUTING.map(r=>r.cost), backgroundColor:['#c3c8dd','#4a3aa7','#2a78d6','#d03b3b'],
      borderRadius:4, borderSkipped:false, maxBarThickness:36}]},
    options:(()=>{const o=clone(CH_BASE); o.plugins.legend.display=false;
      o.scales.y.ticks.callback=v=>'$'+v; return o;})()});
  mk('twch-cost',{type:'line',
    data:{labels:['Mon','Tue','Wed','Thu','Fri','Today'], datasets:[
      {label:'Spend', data:TW_COST.trend, borderColor:'#4a3aa7', backgroundColor:'rgba(74,58,167,.10)',
       borderWidth:2, tension:.3, pointRadius:4, fill:true},
      {label:'Daily ceiling', data:[48000,48000,48000,48000,48000,48000], borderColor:'#d03b3b',
       backgroundColor:'#d03b3b', borderWidth:1.5, borderDash:[5,4], pointRadius:0}]},
    options:(()=>{const o=clone(CH_BASE); o.scales.y.ticks.callback=v=>'$'+(v/1000)+'k'; return o;})()});
  mk('twch-lat',{type:'bar',
    data:{labels:['<2s','2–5s','5–10s','10–20s','20–40s','>40s'], datasets:[{label:'Jobs',
      data:[4120,5240,2980,1210,560,171], backgroundColor:'#2a78d6', borderRadius:4, borderSkipped:false, maxBarThickness:44}]},
    options:(()=>{const o=clone(CH_BASE); o.plugins.legend.display=false; return o;})()});
}

registerDeck('tower', {
  home:'twmission',
  strip:TW_INSTRUMENTS,
  charts:twCharts,
  nav:[
    {g:'Operations', items:[{id:'twmission',i:'agents',n:'Mission Control'},{id:'twagents',i:'code',n:'Agents'},
      {id:'twworkflows',i:'projects',n:'Workflows'}]},
    {g:'Control', items:[{id:'twapprovals',i:'blockers',n:'Approvals',c:()=>143,cls:'warn'},
      {id:'twfailures',i:'incidents',n:'Failures',c:()=>28,cls:'alert'},{id:'twpermissions',i:'vault',n:'Permissions'}]},
    {g:'Platform', items:[{id:'twmodels',i:'readiness',n:'Models'},{id:'twcost',i:'budget',n:'Cost'},
      {id:'twobs',i:'impact',n:'Observability'}]},
    {g:'Governance', items:[{id:'twsecurity',i:'vault',n:'Security',c:()=>21,cls:'warn'},{id:'twpolicies',i:'decisions',n:'Policies'}]}
  ],
  views:{
    twmission:twvMission, twagents:twvAgents, twworkflows:twvWorkflows, twapprovals:twvApprovals,
    twfailures:twvFailures, twmodels:twvModels, twcost:twvCost, twsecurity:twvSecurity,
    twpermissions:twvPermissions, twobs:twvObs, twpolicies:twvPolicies
  }
});
