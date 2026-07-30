/**
 * Jobs view.
 *
 * Not a board. Seven sections, each answering a different question a candidate
 * has, with transparent match reasoning and recruiter trust on every card.
 */

import { html, action } from '../dom.js';
import { state, isDismissed, isSaved } from '../store.js';
import { jobs, jobSections } from '../data/jobs.js';
import { personaFor } from '../data/personas.js';
import { profileFor } from '../data/profiles.js';
import { recruiters } from '../data/people.js';
import { icon } from '../components/icons.js';
import { jobMatchCard } from '../components/job-match-card.js';
import { recruiterTrustCard } from '../components/recruiter-trust-card.js';
import { skillEvidencePanel } from '../components/skill-evidence-panel.js';
import { sectionHead, evidenceList, emptyState } from '../components/primitives.js';

export function jobsView() {
  const persona = personaFor(state.intent, state.hiringView);
  // A roles surface is only assembled for people who are actually looking at
  // roles. Renata is filling them and Wei is not looking, and handing either of
  // them a job seeker's dashboard would contradict the mode they chose.
  if (!JOB_SEEKING.includes(persona.id)) return notAssembled(persona);

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
              <p class="small secondary" style="margin-top:3px">${filterLine(persona)}</p>
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

/* ---------- Who gets a roles surface at all ---------- */

const JOB_SEEKING = ['candidate', 'builder', 'explorer'];

/** The filter line is the person's own goal, not a hardcoded one. */
function filterLine(persona) {
  const g = profileFor(persona.id).goal;
  if (!g) return 'Ranked on scope and problem overlap rather than title and band.';
  return `${g.level} · ${g.geography} · ${g.workModel} · ${g.industries.join(', ')}`;
}

/**
 * The honest empty state. Padding this page with roles nobody asked for is the
 * behaviour the whole prototype argues against, so it is not done here either.
 */
function notAssembled(persona) {
  return html`
    <div class="layout-1col-wide">
      <div class="center-stack">
        <header>
          <p class="eyebrow">Jobs · ${persona.label} mode</p>
          <h1 class="display" style="margin-top:8px">No roles surface is assembled for this mode</h1>
          <p class="lede">
            You are signed in as ${persona.name}, ${persona.title} at ${persona.org}, in
            <b>${persona.label.toLowerCase()}</b> mode. Nothing here is looking for a job on your behalf.
          </p>
        </header>

        <section class="card card-pad">
          <p class="small secondary">
            No job-search ranking runs in this mode, no availability signal is generated, and no recruiter
            is told anything about you. This page is empty on purpose rather than padded with roles that
            would only exist to fill it.
          </p>
          <div class="btn-row" style="margin-top:14px">
            <button type="button" class="btn btn-primary btn-sm" ${action('navigate', { route: 'home' })}>
              Back to your dashboard
            </button>
            <button type="button" class="btn btn-sm" ${action('toggle-intent-menu')}>
              Change what you are here for
            </button>
          </div>
        </section>
      </div>
    </div>
  `;
}
