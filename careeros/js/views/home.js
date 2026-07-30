/**
 * Home dashboard.
 *
 * A morning briefing, not a feed. The centre column is assembled from the
 * active intent: under Job hunting it leads with roles and hiring signals;
 * under Hiring it becomes a candidate and pipeline surface; every other intent
 * gets its own emphasis.
 */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { intentById } from '../data/user.js';
import { jobs } from '../data/jobs.js';
import { candidates, recruiters, pipeline, hiringBottlenecks } from '../data/people.js';
import { visibleEvents, visibleNextActions } from '../data/signals.js';
import { personaFor } from '../data/personas.js';
import { otherPeople } from '../components/networking-panel.js';
import { activeLayout, customiseBar } from '../components/dashboard-customizer.js';
import { icon } from '../components/icons.js';
import { profileSummary, careerGoal, personaOverview, teamActivity } from '../components/profile-summary.js';
import { reputationPanel } from '../components/reputation-panel.js';
import { careerAgentPanel } from '../components/career-agent-panel.js';
import { signalSummaryCards } from '../components/signal-summary-cards.js';
import { signalNotifications } from '../components/signal-notifications.js';
import { knowledgeFeed, feedPriorityControl } from '../components/knowledge-feed.js';
import { jobMatchCard } from '../components/job-match-card.js';
import { personRailCard } from '../components/person-recommendation-card.js';
import { candidateRailCard, candidateCard } from '../components/candidate-card.js';
import { eventRecommendation } from '../components/event-recommendation.js';
import { skillEvidencePanel } from '../components/skill-evidence-panel.js';
import { sectionHead, evidenceList, meter } from '../components/primitives.js';

export function homeView() {
  const intent = intentById(state.intent);
  const persona = personaFor(state.intent, state.hiringView);
  const layout = activeLayout();
  const threeCol = layout.left.length > 0 && layout.right.length > 0;

  return html`
    ${state.customising ? html`<div class="customiser-wrap">${customiseBar()}</div>` : ''}
    <div class="${threeCol ? 'layout-3col' : layout.right.length ? 'layout-2col' : 'layout-1col-wide'}">
      ${layout.left.length ? html`
        <div class="rail rail-left">
          <div class="rail-stack">${layout.left.map((id) => renderPanel(id, intent, persona))}</div>
        </div>
      ` : ''}

      <div class="center-stack">
        ${briefing(intent)}
        ${state.customising ? '' : customiseBar()}
        ${layout.center.map((id) => renderPanel(id, intent, persona))}
      </div>

      ${layout.right.length ? html`
        <div class="rail rail-right">
          <div class="rail-stack">${layout.right.map((id) => renderPanel(id, intent, persona))}</div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * One panel id to one rendered block. Keeping this map exhaustive is what lets
 * the layout be data — a panel the registry offers must render here.
 */
function renderPanel(id, intent, persona) {
  switch (id) {
    case 'identity':       return profileSummary();
    case 'reputation':     return reputationPanel({ compact: true });
    case 'career-goal':    return careerGoal();
    case 'overview':       return personaOverview();
    case 'team-activity':  return teamActivity();
    case 'agent-teaser':   return agentRailTeaser();

    case 'summary':        return signalSummaryCards(state.intent);
    case 'agent':          return careerAgentPanel({ limit: 2 });
    case 'jobs':           return jobsSection(persona);
    case 'skill-gaps':     return skillGapSection(persona);
    case 'feed':           return knowledgeFeed({ heading: true, limit: feedLimit(persona) });
    case 'mode-switch':    return modeSwitch();
    case 'candidates':     return candidateSection();
    case 'bottlenecks':    return bottleneckSection();

    case 'signals':        return signalNotifications({ limit: 4 });
    case 'people':         return peopleRail();
    case 'candidate-rail': return candidateRail();
    case 'events':         return eventsRail();
    case 'recruiters':     return recruiterRail();
    case 'pipeline':       return pipelineRail();
    case 'next-actions':   return nextActionsRail();
    case 'feed-priority':  return feedPriorityControl();
    default:               return html``;
  }
}

function feedLimit(persona) {
  return persona.id === 'professional' || persona.id === 'connector' ? 4 : 3;
}

function jobsSection(persona) {
  const strong = jobs.filter((j) => j.section === 'strong');
  const copy = {
    candidate: ['Roles worth your evening', 'Verified active, above 85% on demonstrated skills, with the reasoning shown.'],
    builder: ['Roles where you would set the architecture', 'Founding and platform-ownership roles, ranked on scope rather than salary band.'],
    explorer: ['One step outside your current field', 'Adjacent roles where your existing evidence still counts for something.'],
  }[persona.id] || ['Roles worth your evening', 'Verified active, with the reasoning shown.'];
  const count = persona.id === 'candidate' ? 2 : 1;

  return html`
    <section aria-labelledby="home-jobs">
      ${sectionHead(copy[0], copy[1],
        html`<button type="button" class="btn btn-sm" ${action('navigate', { route: 'jobs' })}>All ${jobs.length} roles</button>`)}
      <div class="stack-md">${strong.slice(0, count).map((j) => jobMatchCard(j))}</div>
    </section>
  `;
}

/** What a thin skill signal means depends on what this person is trying to do. */
function skillGapSection(persona) {
  const copy = {
    candidate: [
      'The two gaps holding your matches back',
      'Both are documentation problems rather than capability problems. That is the good news and the annoying news.',
    ],
    professional: [
      'Where your own record would not back you up',
      'Not job matches — these are the places you would struggle to point at evidence in a design review.',
    ],
    explorer: [
      'What transfers, and what does not',
      'Two of these carry further into ML platform work than you think. One does not, and it is the one every posting asks for.',
    ],
  }[persona.id] || [
    'Where your evidence is thinnest',
    'Ranked by what the gap is costing you, not by how recently you thought about it.',
  ];

  return html`
    <section aria-labelledby="home-skills">
      ${sectionHead(copy[0], copy[1])}
      ${skillEvidencePanel({ compact: true })}
    </section>
  `;
}

function modeSwitch() {
  const isRecruiter = state.hiringView === 'recruiter';
  return html`
    <div class="card card-pad">
      <div class="row-between wrap">
        <div>
          <p class="eyebrow">Workspace mode</p>
          <p class="small secondary" style="margin-top:3px">
            The same data serves two jobs. Choose the one you are doing today.
          </p>
        </div>
        <div class="filter-row" role="group" aria-label="Workspace mode">
          <button type="button" class="filter-chip" aria-pressed="${!isRecruiter}"
            ${action('set-hiring-view', { view: 'manager' })}>Hiring manager</button>
          <button type="button" class="filter-chip" aria-pressed="${isRecruiter}"
            ${action('set-hiring-view', { view: 'recruiter' })}>Recruiter workspace</button>
        </div>
      </div>
    </div>
  `;
}

function candidateSection() {
  const isRecruiter = state.hiringView === 'recruiter';
  return html`
    <section aria-labelledby="hm-cands">
      ${sectionHead(
        isRecruiter ? 'High-signal candidates' : 'High-potential candidates',
        'Ranked on demonstrated work — published writing, verified outcomes and peer validation. Never on résumé keyword density.',
        html`<button type="button" class="btn btn-sm" ${action('navigate', { route: 'network' })}>All candidates</button>`,
      )}
      <div class="stack-md">${candidates.slice(0, 2).map((c) => candidateCard(c))}</div>
    </section>
  `;
}

function bottleneckSection() {
  return html`
    <section class="card" aria-labelledby="hm-bottle">
      <div class="card-head">
        <h2 id="hm-bottle" class="section-title" style="font-size:16px">Where your hiring is actually stuck</h2>
      </div>
      <div class="divide">
        ${hiringBottlenecks.map((b) => html`
          <div class="insight">
            <p class="insight-happened">${b.title}</p>
            <p class="insight-matters">${b.detail}</p>
            <div class="insight-actions">
              <button type="button" class="btn btn-primary btn-sm" ${action('hiring-action', { id: b.id })}>${b.action}</button>
            </div>
          </div>
        `)}
      </div>
      <div class="card-foot">
        These are computed from your own process data. Two of the three are about your side of the table,
        which is usually where the delay is.
      </div>
    </section>
  `;
}

/* ---------- Briefing ---------- */

function briefing(intent) {
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const persona = personaFor(state.intent, state.hiringView);
  return html`
    <header class="briefing">
      <p class="eyebrow">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · ${intent.label}</p>
      <h1 class="display" style="margin-top:8px">Good ${partOfDay}, ${firstName(persona)}.</h1>
      <p class="lede">${persona.greeting}</p>
    </header>
  `;
}

function firstName(persona) {
  return persona.name.split(' ')[0];
}

/* ---------- Job-seeker centre column ---------- */


/** How the centre column is weighted, per intent. */

/* ---------- Hiring centre column ---------- */




/* ---------- Rails ---------- */

function agentRailTeaser() {
  const p = personaFor(state.intent, state.hiringView);
  const hiring = p.railMode !== 'career';
  return html`
    <section class="card" aria-labelledby="agent-rail">
      <div class="card-head"><h3 id="agent-rail">${hiring ? 'Hiring insights' : 'Career AI insights'}</h3></div>
      <div class="card-body">
        <p class="small secondary">
          ${hiring
            ? 'The agent read your own process data and found three places the loop is stalling. Two of them are on your side of the table.'
            : 'The agent watched 90 days of your professional activity and found five things worth acting on. Two are quick, one is a several-month arc.'}
        </p>
        <button type="button" class="btn btn-primary btn-sm btn-block" style="margin-top:11px"
          ${action('navigate', { route: 'career-agent' })}>
          ${icon('compass', 13)}<span>${hiring ? 'Open hiring intelligence' : 'Open your Career Agent'}</span>
        </button>
      </div>
    </section>
  `;
}

function peopleRail() {
  const pool = otherPeople();
  const top = pool.filter((p) => p.intents.includes(state.intent)).slice(0, 3);
  const list = top.length ? top : pool.slice(0, 3);
  return html`
    <section class="card" aria-labelledby="rail-people">
      <div class="card-head">
        <h3 id="rail-people">People who can help you grow</h3>
      </div>
      <div>${list.map((p) => personRailCard(p))}</div>
      <div class="card-foot">
        <button type="button" class="disclosure-btn" ${action('navigate', { route: 'network' })}>
          <span aria-hidden="true">›</span><span>See all, with the reasoning</span>
        </button>
      </div>
    </section>
  `;
}

function candidateRail() {
  return html`
    <section class="card" aria-labelledby="rail-cands">
      <div class="card-head"><h3 id="rail-cands">Candidates to look at</h3></div>
      <div>${candidates.slice(0, 3).map((c) => candidateRailCard(c))}</div>
    </section>
  `;
}

function eventsRail() {
  return html`
    <section aria-labelledby="rail-events">
      <div class="section-head" style="margin-bottom:10px">
        <div>
          <h3 id="rail-events" class="section-title" style="font-size:16px">Worth your time</h3>
          <p class="tiny secondary">3 of 47 events in your area qualified</p>
        </div>
      </div>
      <div class="stack-sm">
        ${visibleEvents(personaFor(state.intent, state.hiringView).selfId).slice(0, 2).map((e) => eventRecommendation(e, { compact: true }))}
      </div>
    </section>
  `;
}

function recruiterRail() {
  const r = recruiters[0];
  return html`
    <section class="card" aria-labelledby="rail-rec">
      <div class="card-head"><h3 id="rail-rec">Recruiters active in your category</h3></div>
      <div class="card-body">
        <p style="font-size:13.5px;font-weight:600">${recruiters[1].name}</p>
        <p class="tiny muted">${recruiters[1].role}</p>
        <div style="margin-top:9px">
          ${evidenceList([
            'Posted a role matching your saved search 2 days ago',
            '96% candidate response rate over 96 verified interactions',
            'Filled 5 comparable roles in 90 days',
          ])}
        </div>
        <p style="font-size:13.5px;font-weight:600;margin-top:14px">${r.name}</p>
        <p class="tiny muted">${r.role}</p>
        <div style="margin-top:9px">
          ${evidenceList([
            'Median response time 4 hours',
            'Shares the interview loop and rubric up front',
          ])}
        </div>
        <button type="button" class="btn btn-sm btn-block" style="margin-top:13px"
          ${action('navigate', { route: 'jobs' })}>See recruiter trust metrics</button>
      </div>
      <div class="card-foot">
        A recruiter's record is shown so you know how much hope to invest in a conversation.
      </div>
    </section>
  `;
}

function pipelineRail() {
  return html`
    <section class="card" aria-labelledby="rail-pipe">
      <div class="card-head"><h3 id="rail-pipe">Interview pipeline</h3></div>
      <div class="card-body">
        <div class="stack-sm">
          ${pipeline.map((stage) => html`
            <div>
              <div class="row-between">
                <span class="small" style="font-weight:600">${stage.stage}</span>
                <span class="mono small">${stage.count}${stage.health === 'slow' ? html` <span style="color:var(--warning)">slow</span>` : ''}</span>
              </div>
              <div style="margin-top:4px">${meter(Math.min(100, stage.count * 4), stage.health === 'slow' ? 'warning' : '')}</div>
              <p class="tiny muted" style="margin-top:3px">${stage.note}</p>
            </div>
          `)}
        </div>
      </div>
    </section>
  `;
}

function nextActionsRail() {
  const list = visibleNextActions(state.intent, personaFor(state.intent, state.hiringView).selfId);
  return html`
    <section class="card" aria-labelledby="rail-actions">
      <div class="card-head">
        <h3 id="rail-actions">Suggested next actions</h3>
        <span class="tiny muted">By leverage</span>
      </div>
      <div class="divide">
        ${list.map((a, i) => html`
          <button type="button" class="action-item" ${action('next-action', { id: a.id })}>
            <span class="action-index">${String(i + 1).padStart(2, '0')}</span>
            <span class="grow">
              <span class="action-label" style="display:block">${a.label}</span>
              <span class="action-meta" style="display:block">${a.effort} · ${a.payoff}</span>
            </span>
          </button>
        `)}
      </div>
      <div class="card-foot">
        Ordered by expected professional benefit per hour spent, not by how recently they appeared.
      </div>
    </section>
  `;
}
