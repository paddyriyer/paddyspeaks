/**
 * Career Agent view: all findings, the full reputation model, and the skill gaps
 * expressed as consequences rather than percentages.
 */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { skills, intentById } from '../data/user.js';
import { insights, nextActions } from '../data/signals.js';
import { hiringBottlenecks, pipeline } from '../data/people.js';
import { icon } from '../components/icons.js';
import { careerAgentPanel } from '../components/career-agent-panel.js';
import { reputationPanel } from '../components/reputation-panel.js';
import { signalNotifications } from '../components/signal-notifications.js';
import { skillRow } from '../components/skill-evidence-panel.js';
import { sectionHead, evidenceList, meter } from '../components/primitives.js';

export function careerAgentView() {
  const intent = intentById(state.intent);
  const hiring = state.intent === 'hiring';
  return html`
    <div class="layout-2col">
      <div class="center-stack">
        <header>
          <p class="eyebrow">Career Agent · ${intent.label}</p>
          <h1 class="display" style="margin-top:8px">
            ${hiring ? 'What is happening to your hiring' : 'What is happening to your career'}
          </h1>
          <p class="lede">
            ${hiring
              ? 'Five findings from your own process data. Most hiring delays are on the employer\'s side of the table, and these say so.'
              : 'Five findings from 90 days of your professional activity. Each one names what happened, why it matters, the evidence behind it, and the single action worth taking.'}
          </p>
        </header>

        ${hiring ? hiringIntelligence() : html`
          ${careerAgentPanel({ limit: insights.length, showHeader: false })}
          ${gapSection()}
        `}

        ${principleCard()}
      </div>

      <div class="rail">
        <div class="rail-stack">
          ${reputationPanel({ compact: false })}
          ${signalNotifications({ limit: 5 })}
          ${actionsCard()}
        </div>
      </div>
    </div>
  `;
}

function gapSection() {
  const gapped = skills.filter((s) => s.blocking);
  return html`
    <section aria-labelledby="gap-head">
      ${sectionHead(
        'Skill gaps, stated as consequences',
        'A percentage is not motivating. The number of specific roles a gap is costing you is.',
      )}
      <div class="card">
        <div class="divide">
          ${gapped.map((s) => skillRow(s))}
        </div>
        <div class="card-foot">
          All three of these are work you have already done. The gap is publication, not capability —
          which is the most fixable kind of gap and the easiest to leave unfixed for a year.
        </div>
      </div>
    </section>
  `;
}

function hiringIntelligence() {
  return html`
    <section class="card" aria-labelledby="hi-head">
      <div class="card-head">
        <h2 id="hi-head" class="section-title" style="font-size:16px">Hiring bottlenecks</h2>
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
    </section>

    <section class="card" aria-labelledby="pipe-head">
      <div class="card-head"><h2 id="pipe-head" class="section-title" style="font-size:16px">Pipeline health</h2></div>
      <div class="card-body">
        <div class="stack-md">
          ${pipeline.map((stage) => html`
            <div>
              <div class="row-between">
                <span class="small" style="font-weight:600">${stage.stage}</span>
                <span class="mono small">${stage.count}</span>
              </div>
              <div style="margin-top:5px">${meter(Math.min(100, stage.count * 4), stage.health === 'slow' ? 'warning' : '')}</div>
              <p class="tiny muted" style="margin-top:4px">${stage.note}</p>
            </div>
          `)}
        </div>
      </div>
      <div class="card-foot">
        Candidate withdrawal is tracked as a failure of your process, not as candidate flakiness.
      </div>
    </section>
  `;
}

function actionsCard() {
  const list = nextActions[state.intent] || nextActions['job-hunting'];
  return html`
    <section class="card" aria-labelledby="act-head">
      <div class="card-head">
        <h3 id="act-head">This week, in order</h3>
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
    </section>
  `;
}

function principleCard() {
  return html`
    <section class="card" aria-labelledby="prin-head">
      <div class="card-head"><h2 id="prin-head" class="section-title" style="font-size:16px">What this agent will not do</h2></div>
      <div class="card-body">
        ${evidenceList([
          'Tell you to "improve your profile", "network more" or "stay active"',
          'Recommend an action it cannot tie to a specific consequence',
          'Identify an individual who viewed your profile',
          'Manufacture urgency about a role that is not actually closing',
          'Encourage you to post so that your engagement stays up',
          'Present a guess as a finding — low-confidence findings are labelled provisional',
        ], 'gap')}
        <p class="reason" style="margin-top:14px">
          ${icon('info', 13)}
          <span>
            If the agent cannot explain why something is useful to you professionally, the correct
            behaviour is silence. Five findings this quarter is a feature.
          </span>
        </p>
      </div>
      <div class="card-foot">
        <button type="button" class="disclosure-btn" ${action('navigate', { route: 'philosophy' })}>
          <span aria-hidden="true">›</span><span>Read the product philosophy</span>
        </button>
      </div>
    </section>
  `;
}
