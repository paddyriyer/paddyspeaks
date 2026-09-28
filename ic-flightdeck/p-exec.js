'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   EXECUTIVE BRIEFING — deliberately the smallest deck in the product.
   Six modules, business signals only. No employee-level data reaches
   this layer: seniority does not grant access to a person's cockpit.
   ═══════════════════════════════════════════════════════════════════════ */

const EX_SIGNALS = [
  {v:'+2.4pts', l:'Checkout conversion', s:'against a 4-point FY goal', tone:'good', dd:'up',
   spark:[0,0.4,0.9,1.4,2.0,2.4], ico:'impact'},
  {v:'99.96%',  l:'Transaction success', s:'Q3 target 99.95% — met', tone:'good', dd:'up',
   spark:[99.88,99.90,99.91,99.93,99.95,99.96], ico:'okrs'},
  {v:'$4.1M',   l:'Annualised cost removed', s:'infrastructure and rework', tone:'good', dd:'up',
   spark:[0.9,1.6,2.2,3.0,3.6,4.1], ico:'budget'},
  {v:'58%',     l:'FY27 capability readiness', s:'3 capabilities below 50%', tone:'warn', dd:'neu',
   spark:[38,42,47,51,55,58], ico:'readiness'},
  {v:'$118k',   l:'Daily capacity returned by agents', s:'against $34.8k spend', tone:'good', dd:'up',
   spark:[62,74,86,97,108,118], ico:'agents'},
  {v:'61%',     l:'AI roles filled internally', s:'24% last year', tone:'good', dd:'up',
   spark:[24,31,38,47,54,61], ico:'career'}
];

const EX_RISKS = [
  {t:'AI evaluation capability is the binding constraint', sev:'High', tone:'crit',
   d:'Three FY27 initiatives depend on it. Supply covers 32% of projected demand, and it is the only named capability with no internal centre of excellence.',
   ask:'Fund the Orion evaluation cohort now, or accept a two-quarter slip on the agent platform.',
   own:'AI Platform · People & Skills'},
  {t:'Agent approval queue is growing faster than headcount', sev:'High', tone:'ser',
   d:'143 agent workflows are paused for human decisions, 31 of them over four hours. The gate is correct; the volume is the problem.',
   ask:'Approve scoped-permission work so fewer actions need a human, rather than lowering the gate.',
   own:'AI Platform'},
  {t:'Checkout latency has not met target', sev:'Medium', tone:'warn',
   d:'p99 sits at 760 ms against a 400 ms target. Conversion gains so far came from reliability, not speed.',
   ask:'No decision needed this month; the release train decision sits with engineering.',
   own:'Commerce Platform'},
  {t:'Single-owner capabilities in two teams', sev:'Medium', tone:'warn',
   d:'Payments domain knowledge and AI evaluation each rest on one person in the Commerce org. This is a continuity risk, not a performance observation.',
   ask:'Sponsor paired development in the next planning cycle.',
   own:'Commerce Platform'}
];

const EX_TRANSFORM = {
  mix:[{l:'Human-leveraged', v:31, hex:'#1baf7a'},{l:'AI-augmentable', v:44, hex:'#2a78d6'},
       {l:'High automation exposure', v:25, hex:'#eb6834'}],
  adoption:[{q:'Q1 26',v:18},{q:'Q2 26',v:34},{q:'Q3 26',v:56},{q:'Q4 26 (proj)',v:71}],
  net:'Agents returned an estimated $118k of capacity today against $34.8k of spend — a net position of roughly +$83k a day, before any judgement about what that capacity was reinvested in.'
};

const EX_RESKILL = [
  {l:'Employees with adjacent skills', v:2140, hex:'#2a78d6'},
  {l:'Could transition in under 3 months', v:780, hex:'#1baf7a'},
  {l:'Internal transition roles open', v:312, hex:'#4a3aa7'},
  {l:'Moves completed this quarter', v:192, hex:'#eda100'}
];

const EX_INSTRUMENTS = [
  {id:'exbiz',  label:'Business Impact', value:'+2.4pts', tone:'good', sub:'checkout conversion · FY goal 4', go:'exbrief', spark:[0,0.4,0.9,1.4,2,2.4]},
  {id:'exready',label:'Workforce Readiness', value:'58%', tone:'warn', sub:'FY27 capability plan', go:'exbrief', spark:[38,42,47,51,55,58]},
  {id:'exai',   label:'AI Adoption', value:'56%', tone:'info', sub:'of eligible work', go:'exbrief', spark:[18,26,34,45,51,56]},
  {id:'exagent',label:'Agent Net Position', value:'+$83k', tone:'good', sub:'per day', go:'exbrief', spark:[28,41,53,66,74,83]},
  {id:'exmob',  label:'Internal Fill Rate', value:'61%', tone:'good', sub:'AI roles · 24% last year', go:'exbrief', spark:[24,31,38,47,54,61]},
  {id:'exrisk', label:'Decisions Needed', value:'2', tone:'crit', sub:'AI evaluation · approval scope', go:'exbrief'}
];

function exvBrief(){
  return `
  <div class="exhero">
    <div>
      <div class="squad-k" style="color:#b9b4d8">${ic('okrs',12)} Executive briefing · ${esc(TODAY)}</div>
      <h2>Six signals, two decisions</h2>
      <div class="sq-sub" style="color:#a9a6bd">Business layer only. No individual employee data reaches this view.</div>
    </div>
    <div class="exhero-r">
      <div><b>2</b><span>decisions for you</span></div>
      <div><b style="color:#7fe3b0">4</b><span>signals improving</span></div>
      <div><b style="color:#ffd166">1</b><span>behind target</span></div>
    </div>
  </div>

  <div class="mrow">${EX_SIGNALS.map(m=>`<div class="mt">
    <div class="mt-top"><div class="ib sm ib-${m.tone}">${ic(m.ico,13)}</div>
      <span class="mt-d ${m.dd}">${m.dd==='up'?'improving':m.dd==='neu'?'holding':'watch'}</span></div>
    <div class="mt-v ${VTONE[m.tone]||''}">${esc(m.v)}</div>
    <div class="mt-l">${esc(m.l)}</div><div class="mt-s">${esc(m.s)}</div>
    <div class="mt-spark">${spark(m.spark,HEX[m.tone],150,24)}</div></div>`).join('')}</div>

  <div class="sec"><h2>Decisions and risks</h2>
    <p>What leadership is actually being asked for</p>
    <span class="sspacer"></span>${chip('2 need a decision','crit')}</div>
  ${EX_RISKS.map(r=>`<div class="card" style="margin-bottom:11px;border-left:4px solid ${HEX[r.tone]}">
    <div class="card-hd"><h3>${esc(r.t)}</h3><span class="chspacer"></span>
      ${chip(r.sev,r.tone)}<span class="tiny muted">${esc(r.own)}</span></div>
    <p class="card-sub" style="line-height:1.65;margin-top:6px">${esc(r.d)}</p>
    <div class="nextact" style="margin-top:10px"><div class="nal">${ic('assistant',10)} The ask</div>
      <div class="nav-t">${esc(r.ask)}</div></div></div>`).join('')}

  <div class="grid g3" style="margin-top:18px">
    <div class="card"><div class="card-hd"><h3>AI transformation</h3></div>
      ${donut(EX_TRANSFORM.mix, '56%', 'adoption', 132)}
      <p class="tiny muted" style="margin-top:11px;line-height:1.55">${esc(EX_TRANSFORM.net)}</p></div>
    <div class="card"><div class="card-hd"><h3>Workforce readiness</h3></div>
      <div class="chart-box sm"><canvas id="exch-ready"></canvas></div></div>
    <div class="card"><div class="card-hd"><h3>Reskilling progress</h3></div>
      ${EX_RESKILL.map(r=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
          <span style="font-size:11px;line-height:1.35">${esc(r.l)}</span>
          <b class="num" style="color:${textInk(r.hex)};font-size:15px">${r.v.toLocaleString()}</b></div>
        <div class="mini-t" style="margin-top:5px"><i style="width:${r.v/2140*100}%;background:${r.hex}"></i></div></div>`).join('')}
      <div class="tiny muted" style="margin-top:10px;line-height:1.5">Build-versus-buy: filling 1,010 AI roles internally instead of hiring saves an estimated $27M and lands two quarters sooner.</div></div>
  </div>

  <div class="card" style="margin-top:16px;border-color:rgba(208,59,59,.26)">
    <div class="card-hd"><div class="ib ib-crit">${ic('vault',15)}</div>
      <h3>What this briefing deliberately does not contain</h3></div>
    <div class="grid g2" style="margin-top:8px">
      ${['Any named employee, at any level of detail','Any ranking of teams or individuals',
         'Any employee-level productivity, activity or exposure figure',
         'Any drill-down path from these numbers to a person',
         'Any recommendation about anyone’s employment',
         'Anything an employee marked private, shared or otherwise']
        .map(g=>`<div class="guard"><span class="gx">✕</span> ${esc(g)}</div>`).join('')}</div>
    <p class="card-sub" style="margin-top:11px;line-height:1.65">Seniority does not widen data access in this product. An executive sees aggregated business signals; a manager sees team operations and what their engineers chose to share; only the employee sees their own cockpit.</p>
  </div>`;
}

function exCharts(){
  if(typeof Chart === 'undefined') return;
  const el = document.getElementById('exch-ready'); if(!el) return;
  S.charts['exch-ready'] = new Chart(el, {type:'bar',
    data:{labels:['AI eng','Agent arch','AI eval','AI security','Data gov','Security'],
      datasets:[
        {label:'Current', data:[64,41,32,38,78,87], backgroundColor:'#2a78d6'},
        {label:'FY27 target', data:[24,41,46,36,6,3], backgroundColor:'#e5e9f3'}]},
    options:(()=>{const o=clone(CH_BASE); o.scales.x.stacked=true; o.scales.y.stacked=true;
      o.scales.y.ticks.callback=v=>v+'%';
      o.datasets={bar:{borderRadius:3,borderSkipped:false,maxBarThickness:26,borderWidth:1,borderColor:'#fff'}};
      return o;})()});
}

registerDeck('exec', {
  home:'exbrief',
  strip:EX_INSTRUMENTS,
  charts:exCharts,
  nav:[{g:'Briefing', items:[{id:'exbrief',i:'okrs',n:'Executive Briefing'}]}],
  views:{exbrief:exvBrief}
});
