/**
 * Jobs view.
 *
 * Not a board. Seven sections, each answering a different question a candidate
 * has, with transparent match reasoning and recruiter trust on every card.
 */

import { html, action } from '../dom.js';
import { state, isDismissed, isSaved } from '../store.js';
import { jobs, jobSections } from '../data/jobs.js';
import { recruiters } from '../data/people.js';
import { icon } from '../components/icons.js';
import { jobMatchCard } from '../components/job-match-card.js';
import { recruiterTrustCard } from '../components/recruiter-trust-card.js';
import { skillEvidencePanel } from '../components/skill-evidence-panel.js';
import { sectionHead, evidenceList, emptyState } from '../components/primitives.js';

export function jobsView() {
  const live = jobs.filter((j) => !isDismissed(j.id));
  const savedCount = jobs.filter((j) => isSaved('jobs', j.id)).length;

  return html`
    <div class="layout-2col">
      <div class="center-stack">
        <header>
          <p class="eyebrow">Jobs · ${live.length} roles that qualified</p>
          <h1 class="display" style="margin-top:8px">Roles, with the reasoning attached</h1>
          <p class="lede">
            Every role here is verified active, carries its salary band where the employer published one,
            and states honestly what you are missing. There is no one-tap apply: an application is worth
            an hour of thought, and the interface should reflect that.
          </p>
        </header>

        <div class="card card-pad">
          <div class="row-between wrap">
            <div>
              <p class="eyebrow">Your filters</p>
              <p class="small secondary" style="margin-top:3px">
                Staff / Principal · California · Remote or hybrid · Healthcare tech, fintech, enterprise AI
              </p>
            </div>
            <div class="btn-row">
              <button type="button" class="btn btn-sm" ${action('open-search')}>
                ${icon('search', 13)}<span>Refine in plain language</span>
              </button>
              <button type="button" class="btn btn-sm btn-quiet" ${action('adjust-goal')}>Adjust career goal</button>
            </div>
          </div>
        </div>

        ${savedCount ? html`
          <p class="reason reason-plain">
            ${icon('bookmark', 13)}
            <span>
              ${savedCount} saved role${savedCount === 1 ? '' : 's'}. Saved roles are re-verified weekly and
              archived automatically when they close, so you never prepare for a role that no longer exists.
            </span>
          </p>
        ` : ''}

        ${jobSections.map((section) => {
          const list = live.filter((j) => j.section === section.id);
          if (!list.length) return '';
          return html`
            <section aria-labelledby="sec-${section.id}">
              ${sectionHead(section.title, section.blurb, html`<span class="tiny mono muted">${list.length}</span>`)}
              <div class="stack-md">${list.map((j) => jobMatchCard(j))}</div>
            </section>
          `;
        })}

        ${live.length === 0 ? emptyState(
          'Every role has been dismissed',
          'The list is empty rather than refilled with weaker matches. Widen your goal or restore a dismissal.',
        ) : ''}

        <section aria-labelledby="rec-trust">
          ${sectionHead(
            'Recruiter transparency',
            'Aggregated from verified candidate interactions, with confidence ranges. Shown so you can calibrate your expectations, not to shame anyone.',
          )}
          <div class="stack-md">
            ${recruiters.map((r) => recruiterTrustCard(r))}
          </div>
        </section>
      </div>

      <div class="rail">
        <div class="rail-stack">
          ${gapImpactCard()}
          ${skillEvidencePanel({ compact: true })}
          ${honestyCard()}
        </div>
      </div>
    </div>
  `;
}

function gapImpactCard() {
  return html`
    <section class="card" aria-labelledby="gap-head">
      <div class="card-head"><h3 id="gap-head">What your gaps cost you</h3></div>
      <div class="card-body">
        <div class="stack-sm">
          <div class="row-between">
            <span class="small">Kubernetes evidence</span>
            <span class="mono small" style="color:var(--warning)">12 roles</span>
          </div>
          <div class="row-between">
            <span class="small">Cost-optimisation evidence</span>
            <span class="mono small" style="color:var(--warning)">7 roles</span>
          </div>
          <div class="row-between">
            <span class="small">ML / feature infrastructure</span>
            <span class="mono small" style="color:var(--warning)">9 roles</span>
          </div>
        </div>
        <p class="small secondary" style="margin-top:13px">
          These three overlap: closing the first two would move 14 distinct roles above your 85% threshold.
          You have already done all three pieces of work. None of it is published.
        </p>
        <button type="button" class="btn btn-primary btn-sm btn-block" style="margin-top:12px"
          ${action('navigate', { route: 'career-agent' })}>See what to publish</button>
      </div>
    </section>
  `;
}

function honestyCard() {
  return html`
    <section class="card" aria-labelledby="honest-head">
      <div class="card-head"><h3 id="honest-head">What we will not do here</h3></div>
      <div class="card-body">
        ${evidenceList([
          'No promoted roles. An employer cannot pay to appear above a better match.',
          'No role shown without a verification date.',
          'No hidden salary band where the employer published one.',
          'No "be an early applicant" nudge on a role with 200 applicants.',
          'No application count inflated to create urgency.',
          'No match score without the reasoning behind it.',
        ], 'gap')}
      </div>
      <div class="card-foot">
        Ranking on this surface is not for sale. If that ever changes, it will be labelled on every card.
      </div>
    </section>
  `;
}
