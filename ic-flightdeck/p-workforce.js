'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   WORKFORCE FLIGHTDECK — capability planning, not an HR dashboard.
   Reads the AGGREGATED layer only: no individual is identifiable here,
   and nothing in this deck can be drilled down to a named person.
   Its question is whether the company can reskill before it recruits or
   restructures — so every output is a path, never a list of people.
   ═══════════════════════════════════════════════════════════════════════ */

const WF_SCOPE = {employees:4180, orgs:11, families:38, asof:'FY27 plan · refreshed weekly'};

const WF_CAPS = [
  {c:'AI engineering',      now:64, need:88, sup:1180, dem:1640, adj:640, tone:'warn'},
  {c:'Agent architecture',  now:41, need:82, sup:430,  dem:1200, adj:510, tone:'ser'},
  {c:'AI evaluation',       now:32, need:78, sup:260,  dem:820,  adj:470, tone:'crit'},
  {c:'AI security',         now:38, need:74, sup:310,  dem:690,  adj:280, tone:'ser'},
  {c:'Data governance',     now:78, need:84, sup:1440, dem:1560, adj:720, tone:'good'},
  {c:'Security',            now:87, need:90, sup:1620, dem:1700, adj:540, tone:'good'},
  {c:'Distributed systems', now:81, need:80, sup:1890, dem:1810, adj:830, tone:'good'},
  {c:'Vector retrieval',    now:29, need:62, sup:190,  dem:640,  adj:390, tone:'crit'}
];

const WF_ADJACENCY = [
  {from:'Data Engineer', to:'AI Data Engineer', n:840, diff:'Moderate', tone:'warn', weeks:'8–12',
   have:['Python','Spark','Data pipelines','Distributed systems','Schema design'],
   need:['Vector databases','RAG pipelines','LLM evaluation','Agent orchestration']},
  {from:'Backend Engineer', to:'AI Platform Engineer', n:1120, diff:'Moderate', tone:'warn', weeks:'10–14',
   have:['APIs and service design','Distributed systems','Observability','Cloud infrastructure'],
   need:['Model serving','Inference architecture','AI evaluation','GPU infrastructure']},
  {from:'QA / Test Engineer', to:'AI Evaluation Engineer', n:310, diff:'Low', tone:'good', weeks:'4–8',
   have:['Test design','Regression suites','Statistical reasoning','Tooling'],
   need:['Offline eval metrics','Human review design','Prompt regression','Bias testing']},
  {from:'Reporting Analyst', to:'Product Analytics / AI Analytics', n:470, diff:'Low', tone:'good', weeks:'6–10',
   have:['SQL','Business domain','Stakeholder communication','Data modelling'],
   need:['Experimentation','Causal inference','Semantic layers','LLM-assisted analysis']},
  {from:'Security Engineer', to:'AI Security Engineer', n:240, diff:'Moderate', tone:'warn', weeks:'8–12',
   have:['Threat modelling','Review process','Identity and access','Compliance'],
   need:['Model threat surfaces','Prompt injection defence','Agent permission design','Data exfiltration paths']},
  {from:'Platform SRE', to:'AI Reliability Engineer', n:290, diff:'Low', tone:'good', weeks:'5–9',
   have:['Incident command','Observability','Capacity planning','Failure semantics'],
   need:['Inference latency','Eval-driven rollout','Agent failure modes','Cost observability']}
];

/* roles whose TASK MIX is changing — never a list of people to remove */
const WF_ROLES = [
  {r:'Reporting analyst',        exp:71, n:470, tone:'crit',
   paths:['Product analytics','AI analytics','Data quality','Business experimentation']},
  {r:'Manual test engineer',     exp:64, n:310, tone:'crit',
   paths:['AI evaluation','Test platform engineering','Release engineering']},
  {r:'Batch ETL engineer',       exp:58, n:390, tone:'ser',
   paths:['Lakehouse engineering','AI data engineering','Data governance']},
  {r:'Tier-1 support engineer',  exp:52, n:520, tone:'ser',
   paths:['Support platform','Incident engineering','Customer reliability']},
  {r:'Technical writer',         exp:46, n:120, tone:'warn',
   paths:['Docs platform','Developer experience','AI content evaluation']},
  {r:'Backend engineer',         exp:27, n:1120, tone:'good',
   paths:['AI platform engineering','Agent reliability','Unchanged — task mix shifts, role holds']}
];

const WF_RESKILL = {
  adjacent:2140, quick:780, exposed:420, openings:312,
  funnel:[{l:'Employees with relevant adjacent skills', v:2140, hex:'#2a78d6'},
          {l:'Could transition in under 3 months',      v:780,  hex:'#1baf7a'},
          {l:'Roles with substantial task automation exposure', v:420, hex:'#eda100'},
          {l:'Internal opportunities offering transition experience', v:312, hex:'#4a3aa7'}],
  note:'Every number here is a route, not a roster. This deck produces no list of people, no ranking and no recommendation about anyone’s employment — those outputs do not exist in the product.'
};

const WF_MOBILITY = {
  moves:[{q:'Q1 26', v:118},{q:'Q2 26', v:146},{q:'Q3 26', v:192},{q:'Q4 26 (proj)', v:240}],
  byPath:[{t:'Into AI engineering roles', v:84},{t:'Into data and governance', v:61},
          {t:'Into platform and reliability', v:47},{t:'Into product and analytics', v:38},
          {t:'Lateral within family', v:62}],
  fill:'61% of FY27 AI-engineering openings are projected to be filled internally, against 24% last year.'
};

const WF_LEARNING = {
  programmes:[
    {t:'LLM systems foundations', enrolled:1840, done:1120, okr:'AI-native platform', tone:'info'},
    {t:'Agent architecture',      enrolled:640,  done:210,  okr:'Agent platform FY27', tone:'ai'},
    {t:'AI evaluation practicum', enrolled:380,  done:96,   okr:'Evaluation capability', tone:'warn'},
    {t:'AI security essentials',  enrolled:520,  done:240,  okr:'Secure AI adoption', tone:'ser'},
    {t:'Data governance',         enrolled:1260, done:980,  okr:'Data governance 84%', tone:'good'}
  ],
  spend:{used:1.82, cap:2.6},
  toSkill:'Completion alone is not capability. A course counts toward readiness only when it is followed by project experience — which is why the readiness figures above move slower than the completion figures.'
};

const WF_INSTRUMENTS = [
  {id:'wfready', label:'FY27 Readiness', value:'58%', tone:'warn', sub:'weighted across 8 capabilities', go:'wfready',
   spark:[38,42,47,51,55,58], note:'Weighted readiness against the FY27 capability plan. Aggregated across 4,180 employees; no individual is identifiable.'},
  {id:'wfgap',  label:'Largest Gap', value:'AI eval', tone:'crit', sub:'560 people short of demand', go:'wfsupply',
   note:'The capability with the widest distance between projected demand and current supply.'},
  {id:'wfadj',  label:'Adjacent Talent', value:'2,140', tone:'good', sub:'already hold transferable skills', go:'wfadjacency',
   spark:[1480,1620,1780,1910,2040,2140], note:'Employees whose current skills are a short distance from a needed capability.'},
  {id:'wfquick',label:'Quick Transitions', value:'780', tone:'good', sub:'under 3 months development', go:'wfreskill'},
  {id:'wfmob',  label:'Internal Moves', value:'192', tone:'info', sub:'this quarter · 240 projected', go:'wfmobility',
   spark:[118,131,146,168,180,192]},
  {id:'wfopen', label:'Transition Roles', value:'312', tone:'ai', sub:'internal openings offering experience', go:'wfmobility'},
  {id:'wflearn',label:'In Development', value:'4,640', tone:'info', sub:'enrolments · 2,646 completed', go:'wflearning'},
  {id:'wfspend',label:'Learning Spend', value:'$1.82M', tone:'neutral', sub:'of $2.6M FY27 budget', go:'wflearning'}
];

/* ── views ──────────────────────────────────────────────────────────── */
function wfvReady(){
  const avg = Math.round(WF_CAPS.reduce((a,c)=>a+c.now,0)/WF_CAPS.length);
  return `
  <div class="wfhero">
    <div>
      <div class="squad-k" style="color:#a7e3c4">${ic('readiness',12)} FY27 capability readiness</div>
      <h2>Can we build it with the people we have?</h2>
      <div class="sq-sub" style="color:#a9b8ae">${esc(WF_SCOPE.asof)} · ${WF_SCOPE.employees.toLocaleString()} employees · aggregated only</div>
    </div>
    <div class="wfhero-n"><div class="wfhero-v">${avg}<small>%</small></div>
      <div class="wfhero-l">weighted readiness</div></div>
  </div>

  <div class="sec"><h2>Capability readiness</h2>
    <p>Current capability against what the FY27 plan calls for</p>
    <span class="sspacer"></span>${chip('3 capabilities below 50%','crit')}</div>
  <div class="card">
    <div class="cvt-hd"><span><i style="width:9px;height:9px;border-radius:2px;background:${HEX.info};display:inline-block"></i> Current</span>
      <span><i style="width:2.5px;height:11px;background:var(--ink);display:inline-block"></i> FY27 target</span></div>
    ${WF_CAPS.map(c=>`<div class="cvt"><div class="cvt-l">${esc(c.c)}</div>
      <div class="cvt-t"><i class="cur" style="width:${c.now}%;background:${HEX[c.tone]}"></i>
        <i class="tgt" style="left:calc(${c.need}% - 1px)"></i></div></div>`).join('')}
  </div>

  <div class="grid g21" style="margin-top:16px">
    <div class="card"><div class="card-hd"><h3>Supply against projected demand</h3><span class="chspacer"></span>
      ${chip('FY27','neutral')}</div>
      <p class="card-sub">Headcount able to do the work today, against what the plan needs.</p>
      <div class="chart-box"><canvas id="wfch-sd"></canvas></div></div>
    <div class="card" style="border-top:3px solid ${HEX.good}">
      <div class="card-hd"><div class="ib ib-good">${ic('career',15)}</div><h3>The reskilling case</h3></div>
      ${WF_RESKILL.funnel.map(f=>`<div style="padding:9px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
          <span style="font-size:11.5px;line-height:1.4">${esc(f.l)}</span>
          <b class="num" style="font-size:16px;color:${textInk(f.hex)}">${f.v.toLocaleString()}</b></div>
        <div class="mini-t" style="margin-top:6px"><i style="width:${f.v/2140*100}%;background:${f.hex}"></i></div></div>`).join('')}
      <div class="btnrow" style="margin-top:12px"><button class="btn ai sm wide" data-go="wfreskill">Open reskilling paths</button></div></div>
  </div>
  <div class="vault-band" style="margin-top:16px"><b>AGGREGATED ONLY</b><span>${esc(WF_RESKILL.note)}</span></div>`;
}

function wfvSupply(){
  return `<div class="page-hd"><div><h1>Skill supply and demand</h1>
    <p>Where the plan needs more capability than the company currently has.</p></div></div>
  ${pulse([{v:'8',l:'capabilities tracked',tone:'neutral'},
           {v:'3',l:'critical gaps',tone:'crit'},
           {v:'2,140',l:'adjacent talent',tone:'good'},
           {v:'1,870',l:'net gap after adjacency',tone:'warn'}])}
  <div class="card"><div class="card-hd"><h3>Demand, supply and adjacency</h3></div>
    <div class="chart-box"><canvas id="wfch-sd2"></canvas></div></div>
  <div class="sec"><h2>Gap detail</h2></div>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Capability</th><th>FY27 demand</th><th>Current supply</th><th>Adjacent talent</th>
      <th>Remaining gap</th><th>Readiness</th></tr></thead>
    <tbody>${WF_CAPS.map(c=>{const gap=Math.max(0,c.dem-c.sup-c.adj);
      return `<tr><td><strong>${esc(c.c)}</strong></td>
        <td class="r">${c.dem.toLocaleString()}</td><td class="r">${c.sup.toLocaleString()}</td>
        <td class="r v-good">${c.adj.toLocaleString()}</td>
        <td class="r ${gap>300?'v-crit':gap>0?'v-warn':'v-good'}">${gap?gap.toLocaleString():'covered'}</td>
        <td>${chip(c.now+'%',c.tone)}</td></tr>`;}).join('')}</tbody></table></div>
  <p class="tiny muted" style="margin-top:12px;line-height:1.6">Adjacent talent are employees whose current skills put the capability within a defined development distance. Counting them before recruiting is the point of this view.</p>`;
}

function wfvAdjacency(){
  return `<div class="page-hd"><div><h1>Skill adjacency</h1>
    <p>How capability the company already has can reach capability it needs.</p></div></div>
  ${pulse([{v:'6',l:'transition paths modelled',tone:'ai'},
           {v:'3,270',l:'employees on a modelled path',tone:'good'},
           {v:'3',l:'low-difficulty paths',tone:'good'},
           {v:'4–14',l:'weeks typical development',tone:'info'}])}
  ${WF_ADJACENCY.map((a,i)=>`<div class="card" style="margin-bottom:11px;border-left:3px solid ${HEX[a.tone]}">
    <div class="card-hd">
      <div class="ib ib-${a.tone}">${ic('readiness',15)}</div>
      <div style="flex:1;min-width:0"><h3>${esc(a.from)} → ${esc(a.to)}</h3>
        <div class="tiny muted" style="margin-top:2px">${a.n.toLocaleString()} employees on this path · typical ${esc(a.weeks)} weeks</div></div>
      ${chip(a.diff+' difficulty',a.tone)}</div>
    <div class="grid g2" style="margin-top:11px">
      <div><div class="tk" style="font-size:8.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--good-ink);margin-bottom:6px">Already transferable</div>
        <div class="tagrow">${a.have.map(h=>tag(h)).join('')}</div></div>
      <div><div class="tk" style="font-size:8.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--serious-ink);margin-bottom:6px">To develop</div>
        <div class="tagrow">${a.need.map(h=>tag(h)).join('')}</div></div>
    </div>
    <div class="btnrow" style="margin-top:11px"><button class="btn sm" data-wfpath="${i}">Build a programme</button></div>
  </div>`).join('')}
  <div class="vault-band"><b>DIFFICULTY, NOT RISK</b>
    <span>Paths carry a transition difficulty — how much development the move needs. They never carry a risk rating about the people on them.</span></div>`;
}

function wfvRoles(){
  return `<div class="page-hd"><div><h1>Role evolution</h1>
    <p>Roles whose task mix is changing substantially, and where those tasks can go.</p></div></div>
  <div class="callout indigo" style="margin-bottom:16px">
    <div class="ib ib-ai">${ic('assistant',15)}</div>
    <div class="co-b"><div class="co-t">This is a map of changing work, not a list of people.</div>
      <div class="tiny">Exposure describes the tasks in a role. It is never attached to a named employee here, and it cannot be used to select anyone for any employment decision.</div></div></div>
  ${pulse([{v:'6',l:'roles with material change',tone:'warn'},
           {v:'2,930',l:'employees in those roles',tone:'neutral'},
           {v:'18',l:'adjacent destinations',tone:'good'},
           {v:'0',l:'roles marked for reduction',tone:'good'}])}
  <div class="card"><div class="card-hd"><h3>Task automation exposure by role</h3></div>
    <div class="chart-box"><canvas id="wfch-roles"></canvas></div></div>
  <div class="sec"><h2>Where the work goes</h2></div>
  <div class="grid g2">${WF_ROLES.map(r=>`<div class="card" style="border-top:3px solid ${HEX[r.tone]}">
    <div class="card-hd"><h3>${esc(r.r)}</h3><span class="chspacer"></span>${chip(r.exp+'% task exposure',r.tone)}</div>
    <div class="tiny muted" style="margin:4px 0 10px">${r.n.toLocaleString()} employees</div>
    <div class="tk" style="font-size:8.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ink4);margin-bottom:7px">Adjacent destinations</div>
    ${r.paths.map(pth=>`<div class="contrib"><i class="cb" style="background:${HEX.good}"></i><div>${esc(pth)}</div></div>`).join('')}
  </div>`).join('')}</div>`;
}

function wfvReskill(){
  const R = WF_RESKILL;
  return `<div class="page-hd"><div><h1>Reskilling opportunity</h1>
    <p>Reskill, redeploy, redesign the work — before recruiting or restructuring.</p></div></div>
  <div class="mrow">
    ${[{v:R.adjacent.toLocaleString(),l:'hold relevant adjacent skills',tone:'info',ico:'career'},
       {v:R.quick.toLocaleString(),l:'could transition in under 3 months',tone:'good',ico:'readiness'},
       {v:R.exposed.toLocaleString(),l:'roles with substantial task exposure',tone:'warn',ico:'impact'},
       {v:R.openings.toLocaleString(),l:'internal roles offering transition experience',tone:'ai',ico:'okrs'}]
      .map(m=>`<div class="mt"><div class="mt-top"><div class="ib sm ib-${m.tone}">${ic(m.ico,13)}</div></div>
        <div class="mt-v ${VTONE[m.tone]||''}">${esc(m.v)}</div>
        <div class="mt-l">${esc(m.l)}</div></div>`).join('')}
  </div>
  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>From exposure to opportunity</h3></div>
      <p class="card-sub">Each step is a population, narrowing to the people a programme could reach this year.</p>
      <div class="chart-box"><canvas id="wfch-funnel"></canvas></div></div>
    <div class="card" style="border-top:3px solid ${HEX.good}">
      <div class="card-hd"><h3>Build, don't buy</h3></div>
      ${kv('FY27 AI-engineering openings','1,640')}
      ${kv('Fillable from adjacent talent','<span class="v-good">1,010</span>')}
      ${kv('External hiring still required','630')}
      ${kv('Cost per internal transition','≈$4,200')}
      ${kv('Cost per external hire','≈$31,000')}
      <div class="callout green" style="margin-top:13px">
        <div class="ib ib-good">${ic('budget',15)}</div>
        <div class="co-b"><div class="co-t">Reskilling 1,010 people instead of hiring them</div>
        <div class="tiny">saves an estimated $27M and fills roles roughly two quarters sooner, because the domain knowledge is already in the building.</div></div></div>
    </div>
  </div>
  <div class="card" style="margin-top:16px;border-color:rgba(208,59,59,.26)">
    <div class="card-hd"><div class="ib ib-crit">${ic('vault',15)}</div><h3>What this deck will never produce</h3></div>
    ${['A list of employees to make redundant','A ranking of employees by exposure, readiness or potential',
       'A prediction about any individual’s employment','An employee-level drill-down from any number on this page',
       'Any output that identifies a person from aggregated data']
      .map(g=>`<div class="guard"><span class="gx">✕</span> ${esc(g)}</div>`).join('')}</div>`;
}

function wfvMobility(){
  const M = WF_MOBILITY;
  return `<div class="page-hd"><div><h1>Internal mobility</h1>
    <p>People moving into the capabilities the plan needs.</p></div></div>
  ${pulse([{v:'192',l:'moves this quarter',tone:'info'},{v:'240',l:'projected next quarter',tone:'good'},
           {v:'61%',l:'AI roles filled internally',tone:'good'},{v:'312',l:'open transition roles',tone:'ai'}])}
  <div class="grid g2 stretch">
    <div class="card"><div class="card-hd"><h3>Internal moves per quarter</h3></div>
      <div class="chart-box sm"><canvas id="wfch-mob"></canvas></div></div>
    <div class="card"><div class="card-hd"><h3>Where people moved</h3></div>
      ${M.byPath.map(x=>miniBar(x.t, x.v, 84, HEX.ai)).join('')}
      <div class="callout green" style="margin-top:12px">
        <div class="ib ib-good">${ic('career',15)}</div>
        <div class="co-b"><div class="co-t">${esc(M.fill)}</div></div></div></div>
  </div>
  <div class="sec"><h2>Open roles that build the missing capabilities</h2></div>
  <div class="grid g3">
    ${[{t:'Project Orion — evaluation workstream',o:'Platform Engineering',n:18,cap:'AI evaluation',tone:'crit'},
       {t:'Agent reliability squad',o:'AI Platform',n:24,cap:'Agent architecture',tone:'ser'},
       {t:'Lakehouse migration cohort',o:'Data Platform',n:41,cap:'AI data engineering',tone:'warn'},
       {t:'AI security working group',o:'Security Platform',n:12,cap:'AI security',tone:'ser'},
       {t:'Experimentation guild',o:'Product Analytics',n:29,cap:'Product analytics',tone:'good'},
       {t:'Inference platform team',o:'AI Platform',n:16,cap:'Model serving',tone:'warn'}]
      .map(o=>`<div class="card"><div class="card-hd"><div class="ib ib-${o.tone}">${ic('okrs',14)}</div>
        <h3>${esc(o.t)}</h3></div>
        <p class="card-sub">${esc(o.o)}</p>
        ${kv('Places',o.n)}${kv('Builds',esc(o.cap))}</div>`).join('')}
  </div>`;
}

function wfvLearning(){
  const L = WF_LEARNING;
  return `<div class="page-hd"><div><h1>Learning investment</h1>
    <p>What the company is spending on capability, and whether it is landing.</p></div></div>
  ${pulse([{v:'4,640',l:'enrolments',tone:'info'},{v:'2,646',l:'completions',tone:'good'},
           {v:'57%',l:'completion rate',tone:'warn'},{v:'$1.82M',l:'of $2.6M budget',tone:'neutral'},
           {v:'192',l:'followed by a real move',tone:'ai'}])}
  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>Programmes against the capability they serve</h3></div>
      <div class="chart-box"><canvas id="wfch-learn"></canvas></div></div>
    <div class="card"><div class="card-hd"><h3>Budget</h3></div>
      <div style="font-size:28px;font-weight:800;font-family:var(--mono);letter-spacing:-.04em;margin:6px 0 3px">$1.82M</div>
      <div class="tiny muted" style="margin-bottom:11px">of $2.6M FY27 learning budget</div>
      <div class="stack" style="height:12px;margin-bottom:9px">
        <i style="width:70%;background:${HEX.ai}"></i><i style="width:30%;background:var(--panel4)"></i></div>
      <div class="legend"><span><i style="background:${HEX.ai}"></i> Committed $1.82M</span>
        <span><i style="background:var(--panel4)"></i> Remaining $780k</span></div>
      <div class="callout amber" style="margin-top:13px">
        <div class="ib ib-warn">${ic('assistant',15)}</div>
        <div class="co-b"><div class="co-t">Completion is not capability</div>
        <div class="tiny">${esc(L.toSkill)}</div></div></div>
    </div>
  </div>
  <div class="sec"><h2>Programmes</h2></div>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Programme</th><th>Enrolled</th><th>Completed</th><th>Rate</th><th>Serves</th></tr></thead>
    <tbody>${L.programmes.map(pr=>`<tr>
      <td><strong>${esc(pr.t)}</strong></td><td class="r">${pr.enrolled.toLocaleString()}</td>
      <td class="r">${pr.done.toLocaleString()}</td>
      <td>${chip(Math.round(pr.done/pr.enrolled*100)+'%', pr.done/pr.enrolled>0.6?'good':pr.done/pr.enrolled>0.35?'warn':'ser')}</td>
      <td class="tiny muted">${esc(pr.okr)}</td></tr>`).join('')}</tbody></table></div>`;
}

function wfvAI(){
  return `<div class="page-hd"><div><h1>AI transformation</h1>
    <p>How work across the company is changing, in aggregate.</p></div></div>
  ${pulse([{v:'31%',l:'human-leveraged work',tone:'good'},{v:'44%',l:'AI-augmentable',tone:'info'},
           {v:'25%',l:'high automation exposure',tone:'warn'},{v:'2,930',l:'employees in changing roles',tone:'neutral'},
           {v:'0',l:'reduction recommendations',tone:'good'}])}
  <div class="grid g2 stretch">
    <div class="card"><div class="card-hd"><h3>Company-wide work mix</h3></div>
      ${donut([{l:'Human-leveraged', v:31, hex:HEX.good, s:'judgement is the product'},
               {l:'AI-augmentable',  v:44, hex:HEX.info, s:'tooling changes the speed'},
               {l:'High automation exposure', v:25, hex:HEX.serious||HEX.ser, s:'candidates for automation'}],
              '25%','high exposure',156)}</div>
    <div class="card"><div class="card-hd"><h3>Exposure by organisation</h3></div>
      <p class="card-sub">Aggregated to the organisation. No team smaller than 25 is shown, so nobody is identifiable.</p>
      <div class="chart-box sm"><canvas id="wfch-org"></canvas></div></div>
  </div>
  <div class="sec"><h2>The plan</h2></div>
  <div class="grid g3">
    ${[{t:'Reskill',n:'2,140 people on a modelled path',d:'Adjacent talent developed into the capability rather than recruited.',tone:'good'},
       {t:'Redeploy',n:'312 internal transition roles',d:'Real project experience is what turns a course into a capability.',tone:'ai'},
       {t:'Redesign the work',n:'420 roles',d:'Where the task mix changes most, the role is redesigned around what humans are for.',tone:'info'}]
      .map(x=>`<div class="card" style="border-top:3px solid ${HEX[x.tone]}">
        <div class="card-hd"><h3>${esc(x.t)}</h3></div>
        <div style="font-size:15px;font-weight:800;margin:8px 0 6px;letter-spacing:-.02em">${esc(x.n)}</div>
        <p class="tiny" style="line-height:1.55">${esc(x.d)}</p></div>`).join('')}
  </div>`;
}

/* ── charts ─────────────────────────────────────────────────────────── */
function wfCharts(){
  if(typeof Chart === 'undefined') return;
  const mk = (id,cfg)=>{const el=document.getElementById(id); if(el) S.charts[id]=new Chart(el,cfg);};
  const labels = WF_CAPS.map(c=>c.c);
  const sd = (id) => mk(id, {type:'bar',
    data:{labels, datasets:[
      {label:'Current supply', data:WF_CAPS.map(c=>c.sup), backgroundColor:'#2a78d6'},
      {label:'Adjacent talent', data:WF_CAPS.map(c=>c.adj), backgroundColor:'#1baf7a'},
      {label:'FY27 demand', data:WF_CAPS.map(c=>c.dem), backgroundColor:'#c3c8dd'}]},
    options:(()=>{const o=clone(CH_BASE);
      o.scales.y.title={display:true,text:'people',font:{family:'Inter',size:10},color:'#7b8195'};
      o.datasets={bar:{borderRadius:3,borderSkipped:false,maxBarThickness:16,borderWidth:0}};
      return o;})()});
  sd('wfch-sd'); sd('wfch-sd2');
  mk('wfch-roles', {type:'bar',
    data:{labels:WF_ROLES.map(r=>r.r), datasets:[{label:'Task automation exposure',
      data:WF_ROLES.map(r=>r.exp), backgroundColor:WF_ROLES.map(r=>HEX[r.tone]),
      borderRadius:4, borderSkipped:false, maxBarThickness:28}]},
    options:(()=>{const o=clone(CH_BASE); o.indexAxis='y'; o.plugins.legend.display=false;
      o.scales.x.ticks.callback=v=>v+'%'; return o;})()});
  mk('wfch-funnel', {type:'bar',
    data:{labels:WF_RESKILL.funnel.map(f=>f.l.length>34?f.l.slice(0,32)+'…':f.l),
      datasets:[{label:'People', data:WF_RESKILL.funnel.map(f=>f.v),
        backgroundColor:WF_RESKILL.funnel.map(f=>f.hex), borderRadius:4, borderSkipped:false, maxBarThickness:30}]},
    options:(()=>{const o=clone(CH_BASE); o.indexAxis='y'; o.plugins.legend.display=false; return o;})()});
  mk('wfch-mob', {type:'bar',
    data:{labels:WF_MOBILITY.moves.map(m=>m.q), datasets:[{label:'Internal moves',
      data:WF_MOBILITY.moves.map(m=>m.v), backgroundColor:'#4a3aa7', borderRadius:4, borderSkipped:false, maxBarThickness:40}]},
    options:(()=>{const o=clone(CH_BASE); o.plugins.legend.display=false; return o;})()});
  mk('wfch-learn', {type:'bar',
    data:{labels:WF_LEARNING.programmes.map(p=>p.t), datasets:[
      {label:'Completed', data:WF_LEARNING.programmes.map(p=>p.done), backgroundColor:'#1baf7a'},
      {label:'Still enrolled', data:WF_LEARNING.programmes.map(p=>p.enrolled-p.done), backgroundColor:'#c3c8dd'}]},
    options:(()=>{const o=clone(CH_BASE); o.scales.x.stacked=true; o.scales.y.stacked=true;
      o.datasets={bar:{borderRadius:3,borderSkipped:false,maxBarThickness:26,borderWidth:1,borderColor:'#fff'}};
      return o;})()});
  mk('wfch-org', {type:'bar',
    data:{labels:['Commerce','Platform','Data','Security','Support','Analytics','Infrastructure'],
      datasets:[
        {label:'Human-leveraged', data:[34,38,29,41,22,26,33], backgroundColor:'#1baf7a'},
        {label:'AI-augmentable', data:[46,44,42,40,38,41,45], backgroundColor:'#2a78d6'},
        {label:'High exposure', data:[20,18,29,19,40,33,22], backgroundColor:'#eb6834'}]},
    options:(()=>{const o=clone(CH_BASE); o.scales.x.stacked=true; o.scales.y.stacked=true;
      o.scales.y.ticks.callback=v=>v+'%';
      o.datasets={bar:{borderRadius:3,borderSkipped:false,maxBarThickness:34,borderWidth:1,borderColor:'#fff'}};
      return o;})()});
}

registerDeck('workforce', {
  home:'wfready',
  strip:WF_INSTRUMENTS,
  charts:wfCharts,
  nav:[
    {g:'Capability', items:[{id:'wfready',i:'readiness',n:'Capability Readiness'},
      {id:'wfsupply',i:'impact',n:'Supply / Demand',c:()=>3,cls:'alert'},{id:'wfadjacency',i:'career',n:'Skill Adjacency'}]},
    {g:'Transition', items:[{id:'wfroles',i:'projects',n:'Role Evolution'},{id:'wfreskill',i:'learning',n:'Reskilling'},
      {id:'wfmobility',i:'okrs',n:'Internal Mobility'}]},
    {g:'Investment', items:[{id:'wflearning',i:'learning',n:'Learning'},{id:'wfai',i:'agents',n:'AI Transformation'}]}
  ],
  views:{
    wfready:wfvReady, wfsupply:wfvSupply, wfadjacency:wfvAdjacency, wfroles:wfvRoles,
    wfreskill:wfvReskill, wfmobility:wfvMobility, wflearning:wfvLearning, wfai:wfvAI
  }
});
