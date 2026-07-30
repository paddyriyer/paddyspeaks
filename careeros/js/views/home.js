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
import { user, intentById } from '../data/user.js';
import { jobs } from '../data/jobs.js';
import { people, candidates, recruiters, pipeline, hiringBottlenecks } from '../data/people.js';
import { events, nextActions } from '../data/signals.js';
import { personaFor } from '../data/personas.js';
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
  return html`
    <div class="layout-3col">
      <div class="rail rail-left">
        <div class="rail-stack">
          ${profileSummary()}
          ${personaFor(state.intent, state.hiringView).railMode === 'career' ? html`
            ${reputationPanel({ compact: true })}
            ${careerGoal()}
          ` : html`
            ${personaOverview()}
            ${teamActivity()}
          `}
          ${agentRailTeaser()}
        </div>
      </div>

      <div class="center-stack">
        ${briefing(intent)}
        ${signalSummaryCards(state.intent)}
        ${state.intent === 'hiring' ? hiringCentre() : jobSeekerCentre(intent)}
      </div>

      <div class="rail rail-right">
        <div class="rail-stack">
          ${signalNotifications({ limit: 4 })}
          ${state.intent === 'hiring' ? candidateRail() : peopleRail()}
          ${eventsRail()}
          ${state.intent === 'hiring' ? pipelineRail() : recruiterRail()}
          ${nextActionsRail()}
          ${feedPriorityControl()}
        </div>
      </div>
    </div>
  `;
}

/* ---------- Briefing ---------- */

function briefing(intent) {
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return html`
    <header class="briefing">
      <p class="eyebrow">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · ${intent.label}</p>
      <h1 class="display" style="margin-top:8px">Good ${partOfDay}, ${user.firstName}.</h1>
      <p class="lede">${personaFor(state.intent, state.hiringView).greeting}</p>
    </header>
  `;
}

/* ---------- Job-seeker centre column ---------- */

function jobSeekerCentre(intent) {
  const strong = jobs.filter((j) => j.section === 'strong');
  const emphasis = centreEmphasis(state.intent);

  return html`
    ${careerAgentPanel({ limit: 2 })}

    ${emphasis.showJobs ? html`
      <section aria-labelledby="home-jobs">
        ${sectionHead(
          emphasis.jobsTitle,
          emphasis.jobsBlurb,
          html`<button type="button" class="btn btn-sm" ${action('navigate', { route: 'jobs' })}>All ${jobs.length} roles</button>`,
        )}
        <div class="stack-md">
          ${strong.slice(0, emphasis.jobCount).map((j) => jobMatchCard(j))}
        </div>
      </section>
    ` : ''}

    ${emphasis.showSkillPanel ? html`
      <section aria-labelledby="home-skills">
        ${sectionHead(
          'The two gaps holding your matches back',
          'Both are documentation problems rather than capability problems. That is the good news and the annoying news.',
        )}
        ${skillEvidencePanel({ compact: true })}
      </section>
    ` : ''}

    ${knowledgeFeed({ heading: true, limit: emphasis.postCount })}
  `;
}

/** How the centre column is weighted, per intent. */
function centreEmphasis(intentId) {
  switch (intentId) {
    case 'learning':
      return { showJobs: false, showSkillPanel: true, postCount: 5 };
    case 'networking':
      return { showJobs: false, showSkillPanel: false, postCount: 4 };
    case 'mentoring':
      return { showJobs: false, showSkillPanel: false, postCount: 4 };
    case 'building':
      return {
        showJobs: true, jobCount: 1, showSkillPanel: false, postCount: 3,
        jobsTitle: 'Roles where you would set the architecture',
        jobsBlurb: 'Founding and platform-ownership roles, ranked on scope rather than salary band.',
      };
    case 'exploring':
      return {
        showJobs: true, jobCount: 1, showSkillPanel: true, postCount: 3,
        jobsTitle: 'One step outside your current field',
        jobsBlurb: 'Adjacent roles where your existing evidence still counts for something.',
      };
    default:
      return {
        showJobs: true, jobCount: 2, showSkillPanel: true, postCount: 3,
        jobsTitle: 'Roles worth your evening',
        jobsBlurb: 'Verified active, above 85% on demonstrated skills, with the reasoning shown.',
      };
  }
}

/* ---------- Hiring centre column ---------- */

function hiringCentre() {
  const isRecruiter = state.hiringView === 'recruiter';
  return html`
    <div class="card card-pad">
      <div class="row-between wrap">
        <div>
          <p class="eyebrow">Dashboard mode</p>
          <p class="small secondary" style="margin-top:3px">
            The same data serves two jobs. Choose the one you are doing today.
          </p>
        </div>
        <div class="filter-row" role="group" aria-label="Hiring dashboard mode">
          <button type="button" class="filter-chip" aria-pressed="${!isRecruiter}"
            ${action('set-hiring-view', { view: 'manager' })}>Hiring manager</button>
          <button type="button" class="filter-chip" aria-pressed="${isRecruiter}"
            ${action('set-hiring-view', { view: 'recruiter' })}>Recruiter workspace</button>
        </div>
      </div>
    </div>

    ${isRecruiter ? recruiterWorkspace() : hiringManagerDashboard()}
  `;
}

function hiringManagerDashboard() {
  return html`
    <section aria-labelledby="hm-cands">
      ${sectionHead(
        'High-potential candidates',
        'Ranked on demonstrated work — published writing, verified outcomes and peer validation. Never on résumé keyword density.',
        html`<button type="button" class="btn btn-sm" ${action('navigate', { route: 'network' })}>All candidates</button>`,
      )}
      <div class="stack-md">
        ${candidates.slice(0, 2).map((c) => candidateCard(c))}
      </div>
    </section>

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

    <section aria-labelledby="hm-posts">
      ${sectionHead(
        'Recent technical writing by possible candidates',
        'What someone chose to write about tells you more than what they listed under Skills.',
      )}
      ${knowledgeFeed({ heading: false, limit: 2 })}
    </section>
  `;
}

function recruiterWorkspace() {
  const sections = [
    { title: 'High-signal candidates', items: candidates.slice(0, 2) },
    { title: 'Recently active candidates', items: candidates.filter((c) => c.availability === 'Exploring' || c.availability === 'Available now') },
    { title: 'Candidate rediscovery', items: candidates.filter((c) => c.availability === 'Rediscovered') },
  ];
  return html`
    <section class="card" aria-labelledby="rw-head">
      <div class="card-head">
        <h2 id="rw-head" class="section-title" style="font-size:16px">Recruiter workspace</h2>
        <span class="tiny muted">Pipeline health: one bottleneck</span>
      </div>
      <div class="card-body">
        <p class="reason reason-plain">
          ${icon('shield', 13)}
          <span>
            Candidate insights are limited to what a candidate published or did in public. You will never
            see whose profile a candidate viewed, what they searched for, or which roles they opened.
            "Exploring" means they saved a role in your category — nothing more precise than that.
          </span>
        </p>
      </div>
    </section>

    ${sections.filter((s) => s.items.length).map((s) => html`
      <section>
        ${sectionHead(s.title, null)}
        <div class="stack-md">${s.items.map((c) => candidateCard(c))}</div>
      </section>
    `)}
  `;
}

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
  const top = people.filter((p) => p.intents.includes(state.intent)).slice(0, 3);
  const list = top.length ? top : people.slice(0, 3);
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
        ${events.slice(0, 2).map((e) => eventRecommendation(e, { compact: true }))}
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
  const list = nextActions[state.intent] || nextActions['job-hunting'];
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
