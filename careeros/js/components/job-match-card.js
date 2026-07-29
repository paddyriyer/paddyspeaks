/**
 * A job match.
 *
 * The card answers the questions a candidate actually has: is this real, is it
 * still open, who decides, what am I missing, and what are my odds. There is no
 * one-tap apply — applying is a considered act, so the primary action is the
 * role's story.
 */

import { html, action } from '../dom.js';
import { isExpanded } from '../store.js';
import { icon } from './icons.js';
import {
  matchScore, tag, evidenceList, saveButton, dismissButton,
  disclosure, verified, caution, explainControls,
} from './primitives.js';

export function jobMatchCard(job) {
  const storyOpen = isExpanded(`story-${job.id}`);
  return html`
    <article class="card job" aria-labelledby="job-${job.id}">
      <div class="job-top">
        <div class="grow">
          <h3 class="job-title" id="job-${job.id}">${job.title}</h3>
          <p class="job-company">${job.company}</p>
          <div class="job-meta">
            <span>${job.location}</span>
            <span>${job.workModel}</span>
            <span class="job-salary">${job.salary}</span>
          </div>
          <p class="tiny muted" style="margin-top:4px">${job.salaryNote}</p>
        </div>
        ${matchScore(job.match)}
      </div>

      <div class="row wrap" style="margin-top:11px;gap:5px">
        ${verified(job.verified)}
        ${job.trending ? tag(job.trending, 'accent') : ''}
        ${job.status === 'Saved' ? tag('Saved', 'primary') : tag(job.status)}
        ${job.matchIfClosed ? tag(`${job.matchIfClosed}% if gaps closed`, 'accent') : ''}
      </div>

      ${job.hidden ? html`
        <p class="reason reason-plain" style="margin-top:12px">
          ${icon('eye', 13)}<span>${job.hidden}</span>
        </p>
      ` : ''}

      <div class="job-cols">
        <div class="job-col">
          <h4>Why it matches</h4>
          ${evidenceList(job.why, 'pos')}
        </div>
        <div class="job-col">
          <h4>Missing evidence</h4>
          ${evidenceList(job.missing, 'gap')}
        </div>
      </div>

      ${job.gapNote ? html`
        <p class="reason" style="margin-top:12px">${icon('lightbulb', 13)}<span>${job.gapNote}</span></p>
      ` : ''}

      <div style="margin-top:14px">
        <p class="eyebrow" style="margin-bottom:6px">Skills that align</p>
        <div class="row wrap" style="gap:4px">${job.aligned.map((s) => tag(s, 'primary'))}</div>
      </div>

      <dl class="job-trust">
        <div class="trust-item">
          <dt>Hiring manager</dt>
          <dd>${job.hiringManager.name}${job.hiringManager.role ? html`<br><span class="muted">${job.hiringManager.role}</span>` : ''}</dd>
        </div>
        <div class="trust-item">
          <dt>Recruiter quality</dt>
          <dd>${job.recruiter.name}<br><span class="muted">${job.recruiter.quality}</span></dd>
        </div>
        <div class="trust-item">
          <dt>Application status</dt>
          <dd>${job.status}</dd>
        </div>
        <div class="trust-item">
          <dt>Your competitiveness</dt>
          <dd>${job.competitiveness.level}<br><span class="muted">${job.competitiveness.detail}</span></dd>
        </div>
        <div class="trust-item">
          <dt>Is this role genuine</dt>
          <dd>${job.genuine}</dd>
        </div>
        <div class="trust-item">
          <dt>Posted / last verified</dt>
          <dd>${job.posted} · ${job.verified}</dd>
        </div>
      </dl>

      ${job.network && job.network.length ? html`
        <div style="margin-top:14px">
          <p class="eyebrow" style="margin-bottom:6px">People connected to this role</p>
          ${evidenceList(job.network)}
        </div>
      ` : ''}

      ${job.caution ? caution(job.caution) : ''}
      ${job.stretchNote ? html`<p class="reason reason-plain" style="margin-top:12px">${icon('trend', 13)}<span>${job.stretchNote}</span></p>` : ''}

      <div class="btn-row" style="margin-top:15px">
        <button type="button" class="btn btn-primary btn-sm" aria-expanded="${storyOpen}"
          aria-controls="story-panel-${job.id}" ${action('toggle-expand', { id: `story-${job.id}` })}>
          ${icon('book', 13)}<span>View role story</span>
        </button>
        <button type="button" class="btn btn-sm" ${action('ask-agent', { id: job.id })}>
          ${icon('compass', 13)}<span>Ask Career Agent</span>
        </button>
        <button type="button" class="btn btn-sm" ${action('prepare-application', { id: job.id })}>
          Prepare application
        </button>
        ${job.network && job.network.length ? html`
          <button type="button" class="btn btn-sm" ${action('find-intro', { id: job.id })}>Find introduction</button>
        ` : ''}
        ${saveButton('jobs', job.id)}
        ${dismissButton(job.id, 'Not for me')}
      </div>

      ${job.story ? html`
        <div class="story-panel" id="story-panel-${job.id}" ${storyOpen ? '' : 'hidden'}>
          <h4>${job.story.heading}</h4>
          ${job.story.body.map((p) => html`<p>${p}</p>`)}
          <p class="caution" style="margin-top:4px">${icon('alert', 14)}<span>${job.story.risk}</span></p>
        </div>
      ` : html`
        <div class="story-panel" id="story-panel-${job.id}" ${storyOpen ? '' : 'hidden'}>
          <h4>Role story not yet available</h4>
          <p>
            The employer has not answered the six questions behind a role story — why the role exists,
            what the first six months look like, who the last person was, and what would make the hire
            a failure. We do not invent the answers.
          </p>
          <button type="button" class="btn btn-sm" ${action('request-story', { id: job.id })}>
            Ask the employer to complete it
          </button>
        </div>
      `}

      ${disclosure(`whyjob-${job.id}`, 'Why this role?', html`
        <h4>Inputs used</h4>
        ${evidenceList([
          `Demonstrated skill overlap with the posted requirements: ${job.match}%`,
          `Stated preference match: ${job.location.includes('Remote') || job.workModel.includes('Remote') ? 'remote or hybrid, California' : 'California, hybrid tolerated'}`,
          job.network && job.network.length ? 'Someone who can speak to your work is inside the company' : 'No network path — this did not affect the ranking either way',
          `Role verification: ${job.verified.toLowerCase()}`,
        ])}
        <h4 style="margin-top:14px">Not used</h4>
        <p class="small secondary">
          Company size, brand recognition, employer advertising spend, your platform activity,
          or how many other people applied. Ranking is not for sale on this surface.
        </p>
        <h4 style="margin-top:14px">Your controls</h4>
        ${explainControls(job.id)}
      `)}
    </article>
  `;
}

/** Compact job row for rails and the home dashboard. */
export function jobRailRow(job) {
  return html`
    <button type="button" class="signal" ${action('navigate', { route: 'jobs' })}>
      <span class="signal-top">
        <span class="mono" style="font-size:12px;font-weight:700;color:var(--primary)">${job.match}%</span>
        <span class="tiny muted">${job.company}</span>
      </span>
      <span class="signal-title" style="display:block">${job.title}</span>
      <span class="signal-detail" style="display:block">${job.location} · ${job.salary}</span>
    </button>
  `;
}
