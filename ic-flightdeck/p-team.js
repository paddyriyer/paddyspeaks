'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   TEAM FLIGHTDECK — the manager's cockpit.
   Deliberately NOT eight copies of the IC dashboard. A manager decides
   where to spend attention, so this cockpit is organised around the one
   question: is my team succeeding, and where do they need me?
   It reads the TEAM OPERATIONAL layer only. Nothing an engineer marked
   private reaches this deck, at any level of organisational authority.
   ═══════════════════════════════════════════════════════════════════════ */

const TEAM_MGR = {name:'Daniel Kim', role:'Engineering Manager', org:'Commerce Platform'};

const TEAM_PEOPLE = [
  {id:'maya',  n:'Maya Rao',      r:'Senior SWE',  focus:'Payment retry architecture', tenure:'3y 4m'},
  {id:'raj',   n:'Raj Patel',     r:'Staff SWE',   focus:'Checkout platform',          tenure:'5y 1m'},
  {id:'emma',  n:'Emma Chen',     r:'SWE II',      focus:'Observability pipeline',     tenure:'1y 8m'},
  {id:'priya', n:'Priya Nair',    r:'SWE',         focus:'Retry orchestrator',         tenure:'4m'},
  {id:'sam',   n:'Sam Whitfield', r:'Senior SWE',  focus:'Provider integrations',      tenure:'2y 9m'},
  {id:'nina',  n:'Nina Okoro',    r:'SWE II',      focus:'Release engineering',        tenure:'2y 2m'},
  {id:'luca',  n:'Luca Ferrari',  r:'Senior SWE',  focus:'Telemetry and data',         tenure:'4y 6m'},
  {id:'grace', n:'Grace Kim',     r:'SWE',         focus:'Support tooling',            tenure:'11m'}
];

/* the strongest module: specific, actionable, and never a ranking */
const TEAM_NEEDS = [
  {who:'maya', sev:'crit', t:'Security approval has blocked the 7.4 release for 4 days',
   d:'SEC-881 is past its published 3-day SLA. Maya has followed up twice; this now needs your authority, not hers.',
   act:'Escalate to the Security Platform lead', kind:'Unblock', age:'4 days', ev:'SEC-881'},
  {who:'raj', sev:'crit', t:'Conflicting priorities between Product and Platform',
   d:'Product wants the partner API in 7.4; Platform wants the migration finished first. Raj cannot resolve this at his level.',
   act:'Decide the sequence, or convene Elena and Lin', kind:'Decide', age:'2 days', ev:'Roadmap review'},
  {who:'emma', sev:'high', t:'AI evaluation experience needed for Project Orion',
   d:'Emma is the natural fit and has asked to be considered. The skill gap is real but short — roughly four weeks.',
   act:'Sponsor her for the Orion evaluation workstream', kind:'Develop', age:'6 days', ev:'Shared in 1:1'},
  {who:'nina', sev:'high', t:'Third consecutive on-call rotation',
   d:'Nina has covered primary on-call three weeks running because of two swaps. Her planned work has slipped twice.',
   act:'Rebalance the rotation before the next cycle', kind:'Rebalance', age:'ongoing', ev:'PagerDuty schedule'},
  {who:'priya', sev:'med', t:'Ready for design-level scope',
   d:'Priya shipped the retry backoff work independently this sprint, four months in. Maya has flagged she is ready for more.',
   act:'Agree a stretch scope in her next 1:1', kind:'1:1', age:'—', ev:'Mentor note, shared'},
  {who:'grace', sev:'med', t:'Support queue load is crowding out tooling work',
   d:'Grace has absorbed 9 of the 14 unplanned support items this sprint. Her tooling project has not moved in three weeks.',
   act:'Redistribute the queue, or re-plan the tooling milestone', kind:'Rebalance', age:'3 weeks', ev:'ServiceNow'}
];

const TEAM_MISSION = {
  t:'Checkout reliability', pct:82, target:'Q3 target 99.95% transaction success',
  now:'99.96%', trend:[99.88,99.90,99.91,99.93,99.95,99.96],
  sub:[{t:'Transaction success', pct:100, s:'99.96% · target met', tone:'good'},
       {t:'Checkout p99 latency', pct:54, s:'760 ms · target 400 ms', tone:'warn'},
       {t:'Failed retries', pct:88, s:'−31% QoQ · target −35%', tone:'good'},
       {t:'Mean time to detect', pct:41, s:'17 min · target 9 min', tone:'ser'}]
};

const TEAM_PROJECTS = [
  {n:'Checkout API 7.4',            lead:'Raj Patel',  pct:80, state:'At risk', tone:'ser',  people:5, due:'Oct 2',  risk:'Security approval outstanding'},
  {n:'Payment Retry Architecture',  lead:'Maya Rao',   pct:64, state:'On track',tone:'good', people:3, due:'Q4',     risk:'—'},
  {n:'Observability Modernization', lead:'Emma Chen',  pct:41, state:'Scope drift',tone:'warn',people:4, due:'Nov 5', risk:'7 unplanned tasks added'},
  {n:'Provider Expansion',          lead:'Sam Whitfield',pct:22,state:'On track',tone:'good', people:2, due:'Q1 27',  risk:'—'}
];

const TEAM_CAPACITY = {
  planned:320,
  lanes:[{l:'Focus available', v:105, hex:'#1baf7a'},{l:'Operational & support', v:82, hex:'#eda100'},
         {l:'Meetings', v:71, hex:'#2a78d6'},{l:'Incidents', v:34, hex:'#d03b3b'},{l:'Reviews', v:28, hex:'#4a3aa7'}],
  agents:{delegated:64, returned:31},
  trend:[88,84,79,72,68,105],
  note:'Capacity is a planning number, not a measure of anyone. It is here so the work can be re-planned, not so people can be compared.'
};

/* Strong / Developing / Gap — never a score, never a ranking */
const TEAM_CAPS = ['AI evaluation','Agent architecture','Security','Distributed systems','Observability','Payments domain'];
const TEAM_SKILLS = [
  {id:'maya',  v:[1,1,1,2,2,2]},
  {id:'raj',   v:[0,2,1,2,1,2]},
  {id:'emma',  v:[2,2,0,1,2,0]},
  {id:'priya', v:[0,0,0,1,1,1]},
  {id:'sam',   v:[0,1,1,1,1,2]},
  {id:'nina',  v:[0,0,1,1,1,1]},
  {id:'luca',  v:[1,0,0,2,2,1]},
  {id:'grace', v:[0,0,1,0,1,1]}
];
const SK_STATE = ['Gap','Developing','Strong'];
const SK_HEX   = ['#eeedf2','#86b6ef','#2a78d6'];

const TEAM_AI = {
  mix:[{l:'Human judgement', v:44, hex:'#1baf7a', s:'architecture, incidents, negotiation'},
       {l:'AI-augmentable',  v:38, hex:'#2a78d6', s:'review, debugging, drafting'},
       {l:'High automation exposure', v:18, hex:'#eb6834', s:'scaffolding, routine SQL, batch upkeep'}],
  shift:[{t:'Architecture and design', h:14},{t:'Customer and merchant problems', h:7},
         {t:'Security and reliability', h:6},{t:'Mentoring', h:4}],
  returned:31,
  note:'Exposure describes how the work is changing. It is never used to select anyone for any employment decision, and it is not visible to anyone above this cockpit as individual data.'
};

const TEAM_OUTCOMES = [
  {work:'Retry architecture rollout', sys:'Failed transactions retried idempotently',
   cust:'Fewer declined checkouts for merchants', biz:'Retry failures −31%; 2 enterprise merchants retained', tone:'good'},
  {work:'Trace ID unification', sys:'One trace across five payments services',
   cust:'Merchant-facing incidents resolved faster', biz:'Triage 41 → 17 min', tone:'info'},
  {work:'Telemetry cardinality fix', sys:'High-cardinality label removed',
   cust:'No customer-visible change', biz:'≈$4.1k/month infrastructure cost removed', tone:'good'},
  {work:'Provider adapter interface', sys:'Provider quirks isolated behind one contract',
   cust:'New payment methods reach merchants sooner', biz:'Integration 3 weeks → 4 days', tone:'ai'}
];

const TEAM_ONEONONES = [
  {who:'maya',  when:'Wed 2:00 PM', shared:3, topics:['Operational load distribution','Phoenix ingestion ownership','What owning a launch end to end would require'],
   commit:'Sponsor a launch-ownership conversation', done:false},
  {who:'raj',   when:'Wed 4:00 PM', shared:2, topics:['Product vs Platform sequencing','Staff-level scope for Q4'], commit:'Bring the sequencing decision', done:false},
  {who:'emma',  when:'Thu 11:00 AM',shared:2, topics:['Project Orion evaluation workstream','Observability scope drift'], commit:'Confirm Orion sponsorship', done:false},
  {who:'priya', when:'Thu 3:00 PM', shared:1, topics:['Stretch scope after the retry work'], commit:'Agree next scope', done:false},
  {who:'nina',  when:'Fri 10:00 AM',shared:1, topics:['On-call rotation balance'], commit:'Rebalance before next cycle', done:false},
  {who:'grace', when:'Fri 1:00 PM', shared:2, topics:['Support queue load','Tooling milestone re-plan'], commit:'Redistribute the queue', done:false}
];

const TEAM_INSTRUMENTS = [
  {id:'tmission', label:'Team Mission', value:'82%', tone:'good', sub:'Checkout reliability · Q3', go:'tmission', spark:[61,66,70,74,78,82],
   note:'Progress toward the team OKR, computed from the four key results — not from anyone’s activity.'},
  {id:'tblockers',label:'Critical Blockers', value:'3', tone:'crit', sub:'oldest waiting 4 days', go:'tblockers', spark:[1,2,2,3,4,3],
   note:'Blockers your engineers cannot clear at their level.'},
  {id:'tdecide',  label:'Decisions On Me', value:'2', tone:'warn', sub:'Raj · Emma', go:'tneeds', spark:[1,1,2,1,3,2],
   note:'Things that cannot move until you decide.'},
  {id:'tcap',     label:'Focus Capacity', value:'105h', tone:'info', sub:'of 320 h planned', go:'tcapacity', spark:[88,84,79,72,68,105],
   note:'Unstructured time left across the team after meetings, incidents, support and reviews.'},
  {id:'tagents',  label:'Agents Delegated', value:'64h', tone:'ai', sub:'31 h returned to the team', go:'tagents', spark:[18,26,34,44,55,64],
   note:'Work the team handed to agents this week, and the capacity that came back.'},
  {id:'tskill',   label:'Coverage Risk', value:'2', tone:'warn', sub:'capabilities with one owner', go:'tskills',
   note:'Capabilities where only one person is Strong. A staffing risk, never a judgement about anyone.'},
  {id:'t11',      label:'1:1s This Week', value:'6', tone:'neutral', sub:'11 topics shared with you', go:'toneonones',
   note:'Only topics an engineer chose to share appear here.'},
  {id:'tproj',    label:'Active Projects', value:'4', tone:'neutral', sub:'1 at risk · 1 drifting', go:'tprojects'}
];

/* ── helpers local to this deck ─────────────────────────────────────── */
const tPerson = id => TEAM_PEOPLE.find(p=>p.id===id) || {n:id, r:''};
const tAvatar = (id,sz) => {
  const p = tPerson(id), i = p.n.split(' ').map(x=>x[0]).join('').slice(0,2);
  return `<span class="tav ${sz||''}">${esc(i)}</span>`;
};

/* ── views ──────────────────────────────────────────────────────────── */
function tvToday(){
  const m = TEAM_MISSION;
  const crit = TEAM_NEEDS.filter(n=>n.sev==='crit');
  return `
  <div class="tmission">
    <div class="tmission-l">
      <div class="squad-k" style="color:#9fc9ff">${ic('okrs',12)} Team mission status</div>
      <h2>${esc(m.t)}</h2>
      <div class="tmission-sub">${esc(m.target)}</div>
      <div class="tmission-pct">${m.pct}<small>%</small></div>
      <div class="tmission-bar"><i style="width:${m.pct}%"></i></div>
      <div class="tmission-foot">
        <div><b>${TEAM_PEOPLE.length}</b><span>engineers</span></div>
        <div><b>${TEAM_PROJECTS.length}</b><span>projects</span></div>
        <div><b style="color:#ff9b9b">${crit.length}</b><span>critical blockers</span></div>
        <div><b style="color:#ffd166">2</b><span>decisions on you</span></div>
        <div><b style="color:#7fe3b0">21</b><span>agents active</span></div>
      </div>
    </div>
    <div class="tmission-r">
      ${m.sub.map(k=>`<div class="krow">
        <div class="krow-t">${esc(k.t)}</div>
        <div class="krow-b"><i style="width:${k.pct}%;background:${HEX[k.tone]}"></i></div>
        <div class="krow-s">${esc(k.s)}</div></div>`).join('')}
    </div>
  </div>

  <div class="sec"><h2>Where does my team need me?</h2>
    <p>Specific asks, ordered by what is stuck — never by who</p>
    <span class="sspacer"></span>${chip(TEAM_NEEDS.length+' open','warn')}</div>
  ${TEAM_NEEDS.map((n,i)=>`<div class="need need-${n.sev}">
    <div class="need-who">${tAvatar(n.who,'lg')}
      <div><div class="need-n">${esc(tPerson(n.who).n)}</div>
      <div class="need-r">${esc(tPerson(n.who).r)}</div></div></div>
    <div class="need-b">
      <div class="need-t">${esc(n.t)}</div>
      <div class="need-d">${esc(n.d)}</div>
      <div class="need-m">${chip(n.kind, n.sev==='crit'?'crit':n.sev==='high'?'ser':'warn')}
        <span class="tiny muted">waiting ${esc(n.age)}</span>
        <span class="cite" data-k="${esc(n.ev)}">${esc(n.ev)}</span></div>
    </div>
    <div class="need-a">
      <div class="need-act">${esc(n.act)}</div>
      <div class="btnrow" style="margin-top:9px;justify-content:flex-end">
        <button class="btn ai sm" data-tact="${i}">${esc(n.kind)}</button>
        <button class="btn sm" data-go="toneonones">1:1</button></div>
    </div>
  </div>`).join('')}

  <div class="grid g21" style="margin-top:18px">
    <div class="card"><div class="card-hd"><h3>Team capacity this week</h3><span class="chspacer"></span>
      <span class="tiny muted">${TEAM_CAPACITY.planned} h planned</span></div>
      <div class="stack" style="height:26px;margin:10px 0 9px">
        ${TEAM_CAPACITY.lanes.map(l=>`<i style="width:${l.v/TEAM_CAPACITY.planned*100}%;background:${l.hex}"></i>`).join('')}</div>
      <div class="legend">${TEAM_CAPACITY.lanes.map(l=>`<span><i style="background:${l.hex}"></i> ${esc(l.l)} ${l.v}h</span>`).join('')}</div>
      <div class="callout green" style="margin-top:13px">
        <div class="ib ib-good">${ic('agents',15)}</div>
        <div class="co-b"><div class="co-t">${TEAM_CAPACITY.agents.delegated} h delegated to agents · ${TEAM_CAPACITY.agents.returned} h returned</div>
        <div class="tiny">Focus capacity rose from 68 h to 105 h this week.</div></div>
        <button class="btn sm" data-go="tagents">Agents</button></div>
    </div>
    <div class="card"><div class="card-hd"><h3>Projects</h3></div>
      ${TEAM_PROJECTS.map(pr=>`<div class="mini" style="grid-template-columns:1fr auto;padding:7px 0">
        <div style="min-width:0"><div style="font-size:12px;font-weight:600">${esc(pr.n)}</div>
          <div class="tiny muted" style="margin-top:2px">${esc(pr.lead)} · ${pr.people} people · ${esc(pr.due)}</div>
          <div class="mini-t" style="margin-top:5px"><i style="width:${pr.pct}%;background:${HEX[pr.tone]}"></i></div></div>
        <span>${chip(pr.state,pr.tone)}</span></div>`).join('')}
      <div class="btnrow" style="margin-top:11px"><button class="btn sm wide" data-go="tprojects">All projects</button></div></div>
  </div>`;
}

function tvMission(){
  const m = TEAM_MISSION;
  return `<div class="page-hd"><div><h1>Team mission</h1>
    <p>${esc(m.target)}</p></div></div>
  ${pulse([{v:m.pct+'%', l:'toward Q3 target', tone:'good'},
           {v:m.now, l:'transaction success', tone:'good'},
           {v:'760ms', l:'checkout p99', tone:'warn'},
           {v:'17min', l:'mean time to detect', tone:'ser'},
           {v:'4', l:'key results', tone:'neutral'}])}
  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>Transaction success against target</h3></div>
      <div class="chart-box"><canvas id="tch-mission"></canvas></div></div>
    <div class="card"><div class="card-hd"><h3>Key results</h3></div>
      ${m.sub.map(k=>`<div style="padding:10px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;gap:10px">
          <strong style="font-size:12px">${esc(k.t)}</strong>${chip(k.pct>=90?'met':k.pct>=60?'close':'behind',k.tone)}</div>
        <div class="mini-t" style="margin:6px 0 4px"><i style="width:${k.pct}%;background:${HEX[k.tone]}"></i></div>
        <div class="tiny muted">${esc(k.s)}</div></div>`).join('')}</div>
  </div>
  <div class="sec"><h2>How the team's work reached the business</h2></div>
  <div class="card">${flowMap(TEAM_OUTCOMES)}
    <p class="tiny muted" style="margin-top:12px">Attribution is to the work, not to individuals. This cockpit deliberately has no per-person contribution ranking.</p></div>`;
}

function tvOutcomes(){
  return `<div class="page-hd"><div><h1>Outcome map</h1>
    <p>Team work followed through to business results.</p></div></div>
  ${pulse([{v:'−31%',l:'retry failures',tone:'good'},{v:'41→17',l:'triage minutes',tone:'info'},
           {v:'$4.1k',l:'monthly cost removed',tone:'good'},{v:'2',l:'merchants retained',tone:'good'},
           {v:'3w→4d',l:'provider integration',tone:'ai'}])}
  <div class="card">${flowMap(TEAM_OUTCOMES)}</div>
  <div class="sec"><h2>Outcome trend</h2></div>
  <div class="card"><div class="chart-box"><canvas id="tch-out"></canvas></div>
    <p class="tiny muted" style="margin-top:10px">Indexed to Q2 2025 = 100 so three different measures share one axis. Lower is better for all three.</p></div>`;
}

function tvProjects(){
  return `<div class="page-hd"><div><h1>Projects</h1><p>Four active, with the risk named.</p></div></div>
  <div class="grid g2">${TEAM_PROJECTS.map(pr=>`<div class="card" style="border-top:3px solid ${HEX[pr.tone]}">
    <div class="card-hd"><h3>${esc(pr.n)}</h3><span class="chspacer"></span>${chip(pr.state,pr.tone)}</div>
    <div class="mission-bar" style="margin:9px 0 10px"><i style="width:${pr.pct}%;background:${HEX[pr.tone]}"></i></div>
    ${kv('Lead',esc(pr.lead))}${kv('People',pr.people)}${kv('Due',esc(pr.due))}
    ${pr.risk!=='—'?`<div class="conflict" style="margin-top:10px"><div class="ct">${ic('blockers',11)} Risk</div>${esc(pr.risk)}</div>`:''}
  </div>`).join('')}</div>`;
}

function tvBlockers(){
  const rows = TEAM_NEEDS.filter(n=>n.kind==='Unblock'||n.kind==='Decide'||n.sev==='crit');
  return `<div class="page-hd"><div><h1>Team blockers</h1>
    <p>What your engineers cannot clear at their level.</p></div></div>
  ${pulse([{v:String(TEAM_NEEDS.filter(n=>n.sev==='crit').length),l:'critical',tone:'crit'},
           {v:'2',l:'need your decision',tone:'warn'},{v:'4 days',l:'oldest',tone:'crit'},
           {v:'2',l:'external teams',tone:'neutral'}])}
  ${rows.map((n,i)=>`<div class="blk sev-${n.sev==='crit'?'critical':'high'}">
    <div class="blk-band"></div>
    <div class="blk-body">
      <div class="blk-top">${chip(n.sev==='crit'?'critical':'high',n.sev==='crit'?'crit':'ser')}
        <div class="blk-t">${esc(n.t)}</div></div>
      <p class="tiny muted" style="line-height:1.6">${esc(n.d)}</p>
      <div class="blk-grid">
        <div class="bg-i"><div class="bgl">Affects</div><div class="bgv">${esc(tPerson(n.who).n)}</div></div>
        <div class="bg-i"><div class="bgl">Waiting</div><div class="bgv age-hot">${esc(n.age)}</div></div>
        <div class="bg-i"><div class="bgl">Needs</div><div class="bgv">${esc(n.kind)}</div></div>
      </div>
      <div class="nextact" style="margin-top:11px"><div class="nal">${ic('assistant',10)} Your move</div>
        <div class="nav-t">${esc(n.act)}</div></div>
      <div class="btnrow" style="margin-top:11px"><button class="btn ai sm" data-tact="${TEAM_NEEDS.indexOf(n)}">${esc(n.kind)}</button></div>
    </div></div>`).join('')}`;
}

function tvCapacity(){
  const c = TEAM_CAPACITY, used = c.lanes.reduce((a,l)=>a+l.v,0);
  return `<div class="page-hd"><div><h1>Team capacity</h1>
    <p>Where 320 planned hours actually went this week.</p></div></div>
  ${pulse([{v:c.planned+'h',l:'planned capacity',tone:'neutral'},
           {v:'105h',l:'focus available',tone:'good'},
           {v:'82h',l:'operational overhead',tone:'warn'},
           {v:c.agents.delegated+'h',l:'delegated to agents',tone:'ai'},
           {v:c.agents.returned+'h',l:'capacity returned',tone:'good'}])}
  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>Where the week went</h3></div>
      ${donut(c.lanes.map(l=>({l:l.l, v:l.v, hex:l.hex, suffix:'h'})), used+'h', 'accounted', 156)}</div>
    <div class="card"><div class="card-hd"><h3>Focus capacity trend</h3><span class="chspacer"></span>${chip('+37 h this week','good')}</div>
      <p class="card-sub">Unstructured hours left across the team, last six weeks.</p>
      <div class="chart-box sm"><canvas id="tch-cap"></canvas></div>
      <div class="callout green" style="margin-top:12px">
        <div class="ib ib-good">${ic('agents',15)}</div>
        <div class="co-b"><div class="co-t">Agent delegation returned ${c.agents.returned} h</div>
        <div class="tiny">That is most of the 37-hour increase. The rest came from cancelling one recurring meeting.</div></div></div>
    </div>
  </div>
  <p class="tiny muted" style="margin-top:14px;line-height:1.6">${esc(c.note)}</p>`;
}

function tvSkills(){
  const solo = TEAM_CAPS.map((c,i)=>({c, n:TEAM_SKILLS.filter(r=>r.v[i]===2).length}))
    .filter(x=>x.n<=1);
  return `<div class="page-hd"><div><h1>Team skill map</h1>
    <p>Coverage, development needs and bus-factor risk. Not a ranking, and never used as one.</p></div></div>
  ${pulse([{v:String(TEAM_PEOPLE.length),l:'engineers',tone:'neutral'},
           {v:String(TEAM_CAPS.length),l:'capabilities tracked',tone:'neutral'},
           {v:String(solo.length),l:'single-owner capabilities',tone:'warn'},
           {v:String(TEAM_SKILLS.reduce((a,r)=>a+r.v.filter(x=>x===1).length,0)),l:'developing',tone:'info'},
           {v:String(TEAM_SKILLS.reduce((a,r)=>a+r.v.filter(x=>x===0).length,0)),l:'gaps',tone:'ser'}])}
  <div class="card">
    <div class="cov-scroll"><div class="skgrid" style="grid-template-columns:minmax(150px,1.2fr) repeat(${TEAM_CAPS.length},minmax(58px,1fr))">
      <div class="cov-h l">Engineer</div>
      ${TEAM_CAPS.map(c=>`<div class="cov-h">${esc(c)}</div>`).join('')}
      ${TEAM_SKILLS.map(r=>`<div class="skname">${tAvatar(r.id)}${esc(tPerson(r.id).n)}</div>
        ${r.v.map((v,i)=>`<div class="skc" style="background:${SK_HEX[v]}"
          title="${esc(tPerson(r.id).n)} — ${esc(TEAM_CAPS[i])}: ${SK_STATE[v]}">
          <span>${v===2?'●':v===1?'△':'○'}</span></div>`).join('')}`).join('')}
    </div></div>
    <div class="legend" style="margin-top:12px">
      ${SK_STATE.map((st,i)=>`<span><i style="background:${SK_HEX[i]};${i===0?'border:1px solid var(--line2)':''}"></i> ${st}</span>`).join('')}
      <span style="margin-left:8px">● strong · △ developing · ○ gap</span></div>
  </div>

  <div class="grid g2" style="margin-top:16px">
    <div class="card" style="border-top:3px solid ${HEX.warn}">
      <div class="card-hd"><div class="ib ib-warn">${ic('blockers',15)}</div><h3>Coverage risk</h3></div>
      <p class="card-sub">Capabilities where only one engineer is Strong. If that person is away, the work stops.</p>
      ${solo.map(x=>`<div class="kv"><span class="kvk">${esc(x.c)}</span>
        <span class="kvv ${x.n===0?'v-crit':'v-warn'}">${x.n===0?'nobody strong':'one owner'}</span></div>`).join('')}
      <div class="nextact" style="margin-top:11px"><div class="nal">Suggested</div>
        <div class="nav-t">Pair a second engineer into payments-domain work, and sponsor Emma's AI evaluation development — it covers the only capability with nobody Strong.</div></div></div>
    <div class="card" style="border-top:3px solid ${HEX.good}">
      <div class="card-hd"><div class="ib ib-good">${ic('career',15)}</div><h3>Mentoring matches</h3></div>
      <p class="card-sub">Where someone Strong sits beside someone Developing in the same capability.</p>
      ${[['Maya Rao','Priya Nair','Distributed systems'],['Raj Patel','Emma Chen','Agent architecture'],
         ['Luca Ferrari','Maya Rao','Observability'],['Sam Whitfield','Grace Kim','Payments domain']]
        .map(([a,b,c])=>`<div class="mini" style="grid-template-columns:1fr auto">
          <div class="mini-l" style="white-space:normal">${esc(a)} → ${esc(b)}</div>
          <span class="tag soft">${esc(c)}</span></div>`).join('')}</div>
  </div>
  <div class="vault-band" style="margin-top:16px"><b>NOT A RANKING</b>
    <span>This map exists to staff projects, spot single points of failure and find mentoring pairs. It produces no score, no ordering of people, and nothing in it feeds a performance process.</span></div>`;
}

function tvAI(){
  const a = TEAM_AI;
  return `<div class="page-hd"><div><h1>Team AI transition</h1>
    <p>How the team's work is changing, and what that frees up.</p></div></div>
  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>Current work mix</h3></div>
      ${donut(a.mix, a.mix[2].v+'%', 'high exposure', 156)}
      <p class="tiny muted" style="margin-top:12px;line-height:1.55">${esc(a.note)}</p></div>
    <div class="card"><div class="card-hd"><h3>Where freed capacity could go</h3><span class="chspacer"></span>
      ${chip(a.returned+' h returned','good')}</div>
      <p class="card-sub">The team's own stated priorities, not an allocation from above.</p>
      ${a.shift.map(x=>miniBar(x.t, x.h, 14, HEX.ai, ' h')).join('')}
      <div class="callout indigo" style="margin-top:13px">
        <div class="ib ib-ai">${ic('readiness',15)}</div>
        <div class="co-b"><div class="co-t">18% of team work sits in high-exposure categories</div>
        <div class="tiny">Chiefly scaffolding, routine SQL and batch upkeep. That is roughly 58 hours a week across eight people.</div></div></div>
    </div>
  </div>
  <div class="sec"><h2>Exposure by capability area</h2></div>
  <div class="card"><div class="chart-box sm"><canvas id="tch-ai"></canvas></div></div>`;
}

function tvOneOnOnes(){
  return `<div class="page-hd"><div><h1>1:1 centre</h1>
    <p>Six conversations this week. You see only what each engineer chose to share.</p></div></div>
  <div class="vault-band" style="margin-bottom:16px"><b>🔒 SHARED ONLY</b>
    <span>Private notes, career concerns, compensation questions and anything in an engineer's Private Vault never appear here. Organisational authority does not grant access to them.</span></div>
  ${pulse([{v:'6',l:'1:1s this week',tone:'neutral'},
           {v:String(TEAM_ONEONONES.reduce((a,o)=>a+o.shared,0)),l:'topics shared with you',tone:'info'},
           {v:'6',l:'commitments you made',tone:'ai'},
           {v:'2',l:'still unresolved',tone:'warn'}])}
  <div class="grid g2">${TEAM_ONEONONES.map((o,i)=>`<div class="card">
    <div class="card-hd">${tAvatar(o.who,'lg')}
      <div style="flex:1;min-width:0"><h3>${esc(tPerson(o.who).n)}</h3>
        <div class="tiny muted" style="margin-top:2px">${esc(tPerson(o.who).r)} · ${esc(o.when)}</div></div>
      ${chip(o.shared+' shared','info')}</div>
    <div style="margin-top:10px">${o.topics.map(t=>`<div class="contrib"><i class="cb"></i><div>${esc(t)}</div></div>`).join('')}</div>
    <div class="nextact" style="margin-top:10px"><div class="nal">Your commitment</div>
      <div class="nav-t">${esc(o.commit)}</div></div>
    <div class="btnrow" style="margin-top:10px">
      <button class="btn sm" data-tdone="${i}">${S.tdone && S.tdone[i]?'Done ✓':'Mark done'}</button>
      <button class="btn sm" data-tprep="${i}">Prepare</button></div>
  </div>`).join('')}</div>`;
}

function tvAgents(){
  return `<div class="page-hd"><div><h1>Team agents</h1>
    <p>What the team has delegated, and what it cost.</p></div>
    <div class="ph-actions"><button class="btn sm" data-persona="tower">Open the control tower →</button></div></div>
  ${pulse([{v:'21',l:'agents active',tone:'ai'},{v:'184',l:'jobs today',tone:'info'},
           {v:'93%',l:'success rate',tone:'good'},{v:'7',l:'approvals waiting',tone:'warn'},
           {v:'$41.80',l:'spend today',tone:'neutral'},{v:'31h',l:'capacity returned',tone:'good'}])}
  <div class="grid g21 stretch">
    <div class="card"><div class="card-hd"><h3>Delegation by engineer</h3></div>
      <p class="card-sub">Hours handed to agents this week. Shown to help re-plan, never to compare people.</p>
      ${[['maya',9.4],['raj',11.2],['emma',7.8],['priya',4.1],['sam',8.6],['nina',6.3],['luca',10.1],['grace',6.5]]
        .map(([id,h])=>`<div class="mini" style="grid-template-columns:minmax(130px,auto) 1fr auto;gap:10px">
          <div class="mini-l" style="display:flex;align-items:center;gap:8px">${tAvatar(id)}${esc(tPerson(id).n)}</div>
          <div class="mini-t"><i style="width:${h/12*100}%;background:${HEX.ai}"></i></div>
          <span class="mini-v">${h} h</span></div>`).join('')}</div>
    <div class="card"><div class="card-hd"><h3>Spend and return</h3></div>
      <div class="chart-box sm"><canvas id="tch-agents"></canvas></div>
      <div class="kv" style="margin-top:8px"><span class="kvk">Cost per successful workflow</span><span class="kvv">$0.24</span></div>
      <div class="kv"><span class="kvk">Team monthly budget</span><span class="kvv">$890 / $1,400</span></div>
      <div class="kv"><span class="kvk">Estimated capacity returned</span><span class="kvv v-good">31 h</span></div></div>
  </div>`;
}

function tvDevelopment(){
  return `<div class="page-hd"><div><h1>Development</h1>
    <p>Growth conversations your engineers have chosen to share.</p></div></div>
  <div class="vault-band" style="margin-bottom:16px"><b>🔒 SHARED ONLY</b>
    <span>An engineer's AI readiness profile, career exploration and private development notes are theirs. What appears here was shared with you deliberately.</span></div>
  ${pulse([{v:'4',l:'stated growth goals',tone:'ai'},{v:'3',l:'internal opportunities open',tone:'good'},
           {v:'2',l:'sponsorships you owe',tone:'warn'},{v:'11',l:'courses in progress',tone:'info'}])}
  <div class="grid g2">
    ${[{who:'emma', goal:'AI evaluation and agent architecture', ask:'Sponsorship for Project Orion', state:'Waiting on you', tone:'warn'},
       {who:'maya', goal:'Own a production launch end to end', ask:'Phoenix ingestion ownership', state:'Waiting on you', tone:'warn'},
       {who:'priya',goal:'Design-level scope', ask:'A stretch project next quarter', state:'Discussed', tone:'info'},
       {who:'sam',  goal:'Payments security depth', ask:'Security review working group', state:'In progress', tone:'good'}]
      .map(d=>`<div class="card" style="border-left:3px solid ${HEX[d.tone]}">
        <div class="card-hd">${tAvatar(d.who,'lg')}
          <div style="flex:1;min-width:0"><h3>${esc(tPerson(d.who).n)}</h3>
            <div class="tiny muted" style="margin-top:2px">${esc(d.goal)}</div></div>
          ${chip(d.state,d.tone)}</div>
        <div class="nextact" style="margin-top:10px"><div class="nal">What they asked for</div>
          <div class="nav-t">${esc(d.ask)}</div></div></div>`).join('')}
  </div>
  <div class="sec"><h2>Internal opportunities that fit the team</h2></div>
  <div class="grid g3">
    ${[{t:'Project Orion — LLM evaluation', o:'Platform Engineering', fit:'Emma Chen, Maya Rao', tone:'ai'},
       {t:'Lakehouse migration — payments domain', o:'Data Platform', fit:'Luca Ferrari', tone:'info'},
       {t:'AI security working group', o:'Security Platform', fit:'Sam Whitfield', tone:'good'}]
      .map(o=>`<div class="card"><div class="card-hd"><div class="ib ib-${o.tone}">${ic('readiness',14)}</div>
        <h3>${esc(o.t)}</h3></div>
        <p class="card-sub">${esc(o.o)}</p>${kv('Good fit',esc(o.fit))}
        <div class="btnrow" style="margin-top:10px"><button class="btn sm wide" data-act="discuss">Raise in 1:1</button></div></div>`).join('')}
  </div>`;
}

/* ── charts ─────────────────────────────────────────────────────────── */
function tCharts(){
  if(typeof Chart === 'undefined') return;
  const mk = (id, cfg) => { const el = document.getElementById(id); if(el) S.charts[id] = new Chart(el, cfg); };
  const Q = ['Q2 25','Q3 25','Q4 25','Q1 26','Q2 26','Q3 26'];
  mk('tch-mission', {type:'line',
    data:{labels:Q, datasets:[{label:'Transaction success %', data:TEAM_MISSION.trend,
      borderColor:'#1baf7a', backgroundColor:'rgba(27,175,122,.10)', borderWidth:2, tension:.32,
      pointRadius:4, fill:true}]},
    options:(()=>{const o=clone(CH_BASE); o.plugins.legend.display=false; o.scales.y.beginAtZero=false;
      o.scales.y.ticks.callback=v=>v+'%'; return o;})()});
  mk('tch-out', {type:'line',
    data:{labels:Q, datasets:IMPACT_TREND.series.map(x=>({label:x.label, data:x.data, borderColor:x.hex,
      backgroundColor:x.hex, borderWidth:2, tension:.32, pointRadius:4}))},
    options:(()=>{const o=clone(CH_BASE); o.scales.y.beginAtZero=false; return o;})()});
  mk('tch-cap', {type:'bar',
    data:{labels:['W34','W35','W36','W37','W38','W39'], datasets:[{label:'Focus hours available',
      data:TEAM_CAPACITY.trend, backgroundColor:'#1baf7a', borderRadius:4, borderSkipped:false, maxBarThickness:34}]},
    options:(()=>{const o=clone(CH_BASE); o.plugins.legend.display=false; return o;})()});
  mk('tch-ai', {type:'bar',
    data:{labels:['Architecture','Incidents','Review','Debugging','Scaffolding','Routine SQL','Batch upkeep'],
      datasets:[
        {label:'Human judgement', data:[92,84,31,22,4,2,6], backgroundColor:'#1baf7a'},
        {label:'AI-augmentable', data:[8,16,63,68,26,18,22], backgroundColor:'#2a78d6'},
        {label:'High automation exposure', data:[0,0,6,10,70,80,72], backgroundColor:'#eb6834'}]},
    options:(()=>{const o=clone(CH_BASE); o.scales.x.stacked=true; o.scales.y.stacked=true;
      o.scales.y.ticks.callback=v=>v+'%';
      o.datasets={bar:{borderRadius:3,borderSkipped:false,maxBarThickness:34,borderWidth:1,borderColor:'#fff'}};
      return o;})()});
  mk('tch-agents', {type:'line',
    data:{labels:['W34','W35','W36','W37','W38','W39'], datasets:[
      {label:'Spend ($)', data:[12,19,24,31,36,41.8], borderColor:'#4a3aa7', backgroundColor:'#4a3aa7',
       borderWidth:2, tension:.3, pointRadius:4},
      {label:'Capacity returned (h)', data:[6,11,16,22,27,31], borderColor:'#1baf7a', backgroundColor:'#1baf7a',
       borderWidth:2, tension:.3, pointRadius:4}]},
    options:clone(CH_BASE)});
}

/* ── register ───────────────────────────────────────────────────────── */
registerDeck('team', {
  home:'tteam',
  strip:TEAM_INSTRUMENTS,
  charts:tCharts,
  nav:[
    {g:'Command', items:[{id:'tteam',i:'today',n:'Today'},
      {id:'tneeds',i:'blockers',n:'Needs me',c:()=>TEAM_NEEDS.filter(n=>n.sev==='crit').length,cls:'alert'}]},
    {g:'Delivery', items:[{id:'tmission',i:'okrs',n:'Team Mission'},{id:'tprojects',i:'projects',n:'Projects'},
      {id:'toutcomes',i:'impact',n:'Outcomes'},{id:'tblockers',i:'blockers',n:'Blockers',c:()=>3,cls:'alert'}]},
    {g:'People', items:[{id:'tcapacity',i:'calendar',n:'Capacity'},{id:'tskills',i:'career',n:'Skills',c:()=>2,cls:'warn'},
      {id:'toneonones',i:'oneonone',n:'1:1s',c:()=>6},{id:'tdevelopment',i:'learning',n:'Development'}]},
    {g:'AI', items:[{id:'tai',i:'readiness',n:'AI Transition'},{id:'tagents',i:'agents',n:'Agents',c:()=>7,cls:'warn'}]}
  ],
  views:{
    tteam:tvToday, tneeds:tvToday, tmission:tvMission, tprojects:tvProjects, toutcomes:tvOutcomes,
    tblockers:tvBlockers, tcapacity:tvCapacity, tskills:tvSkills, toneonones:tvOneOnOnes,
    tdevelopment:tvDevelopment, tai:tvAI, tagents:tvAgents
  }
});
