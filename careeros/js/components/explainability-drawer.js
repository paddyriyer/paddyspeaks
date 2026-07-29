/**
 * The explainability drawer: a full-height account of one recommendation.
 *
 * Same contract everywhere — inputs used, professional relevance, confidence,
 * what was deliberately not used, and the controls to change it.
 */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { personById, notUsed } from '../data/people.js';
import { jobById } from '../data/jobs.js';
import { insightById } from '../data/signals.js';
import { icon } from './icons.js';
import { evidenceList, factorList, notUsedList, explainControls, matchScore } from './primitives.js';

export function explainabilityDrawer() {
  if (!state.drawer) return html``;
  const { kind, id } = state.drawer;
  const content = kind === 'person' ? personDrawer(id)
    : kind === 'job' ? jobDrawer(id)
    : kind === 'insight' ? insightDrawer(id)
    : kind === 'methodology' ? methodologyDrawer()
    : null;
  if (!content) return html``;

  return html`
    <div class="drawer-scrim" ${action('close-drawer')}></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      ${content}
    </aside>
  `;
}

function drawerShell(title, subtitle, body, foot) {
  return html`
    <div class="drawer-head">
      <div class="grow">
        <p class="eyebrow">Why this?</p>
        <h2 class="drawer-title" id="drawer-title">${title}</h2>
        ${subtitle ? html`<p class="small secondary" style="margin-top:4px">${subtitle}</p>` : ''}
      </div>
      <button type="button" class="icon-btn" ${action('close-drawer')} aria-label="Close">
        ${icon('x', 17)}
      </button>
    </div>
    <div class="drawer-body">${body}</div>
    ${foot ? html`<div class="drawer-foot">${foot}</div>` : ''}
  `;
}

function personDrawer(id) {
  const p = personById(id);
  if (!p) return null;
  return drawerShell(p.name, `${p.role} · ${p.company}`, html`
    <div class="drawer-block">${matchScore(p.match)}</div>
    <div class="drawer-block">
      <h3>Inputs used</h3>
      ${factorList(p.factors)}
    </div>
    <div class="drawer-block">
      <h3>Professional relevance</h3>
      <p class="small secondary">${p.reason}</p>
    </div>
    <div class="drawer-block">
      <h3>Evidence</h3>
      ${evidenceList(p.evidence)}
    </div>
    <div class="drawer-block">
      <h3>Confidence</h3>
      <p class="small secondary">${p.confidence} — ${p.confidence === 'High'
        ? 'several independent signals agree and at least one is verifiable by you.'
        : 'fewer corroborating signals than usual; treat the percentage as approximate.'}</p>
    </div>
    <div class="drawer-block">
      <h3>Not used</h3>
      ${notUsedList(notUsed)}
    </div>
    <div class="drawer-block">
      <h3>Your controls</h3>
      ${explainControls(p.id)}
    </div>
  `, html`
    <button type="button" class="btn btn-primary btn-sm" ${action('open-composer', { id: p.id })}>Draft a message</button>
    <button type="button" class="btn btn-sm" ${action('close-drawer')}>Close</button>
  `);
}

function jobDrawer(id) {
  const j = jobById(id);
  if (!j) return null;
  return drawerShell(j.title, `${j.company} · ${j.location}`, html`
    <div class="drawer-block">${matchScore(j.match)}</div>
    <div class="drawer-block">
      <h3>What the Career Agent would tell you</h3>
      <p class="small secondary">
        ${j.missing.length && !j.missing[0].startsWith('Nothing')
          ? `Your match is limited by evidence, not ability: ${j.missing.join('; ').toLowerCase()}. `
          : 'Nothing material is missing from your evidence for this role. '}
        ${j.competitiveness.detail}
      </p>
    </div>
    <div class="drawer-block">
      <h3>Why it matches</h3>
      ${evidenceList(j.why, 'pos')}
    </div>
    <div class="drawer-block">
      <h3>Missing evidence</h3>
      ${evidenceList(j.missing, 'gap')}
    </div>
    <div class="drawer-block">
      <h3>Is it real</h3>
      <p class="small secondary">${j.genuine} Last verified: ${j.verified.toLowerCase()}.</p>
    </div>
    <div class="drawer-block">
      <h3>Not used</h3>
      <p class="small secondary">
        Company brand, headcount, advertising spend, your platform activity, or applicant volume as a
        popularity proxy. Employers cannot pay to rank higher here.
      </p>
    </div>
    <div class="drawer-block">
      <h3>Your controls</h3>
      ${explainControls(j.id)}
    </div>
  `, html`
    <button type="button" class="btn btn-primary btn-sm" ${action('prepare-application', { id: j.id })}>Prepare application</button>
    <button type="button" class="btn btn-sm" ${action('close-drawer')}>Close</button>
  `);
}

function insightDrawer(id) {
  const ins = insightById(id);
  if (!ins) return null;
  return drawerShell('Career Agent finding', ins.priority, html`
    <div class="drawer-block">
      <h3>What happened</h3>
      <p class="small">${ins.happened}</p>
    </div>
    <div class="drawer-block">
      <h3>Why it matters</h3>
      <p class="small secondary">${ins.matters}</p>
    </div>
    <div class="drawer-block">
      <h3>Evidence</h3>
      ${evidenceList(ins.evidence)}
    </div>
    <div class="drawer-block">
      <h3>Expected benefit</h3>
      <p class="small secondary">${ins.benefit}</p>
    </div>
    <div class="drawer-block">
      <h3>Effort</h3>
      <p class="small secondary">${ins.effort}</p>
    </div>
    <div class="drawer-block">
      <h3>Not used</h3>
      <p class="small secondary">
        No individual's browsing history was shown to produce this. Profile-view searches are aggregated
        and no single viewer is identified to you.
      </p>
    </div>
  `, html`
    <button type="button" class="btn btn-primary btn-sm"
      ${action('navigate', { route: ins.action.route, anchor: ins.action.anchor })}>${ins.action.label}</button>
    <button type="button" class="btn btn-sm" ${action('close-drawer')}>Close</button>
  `);
}

function methodologyDrawer() {
  return drawerShell('How recruiter metrics are measured', 'Aggregated, privacy-preserving, and suppressed at low sample', html`
    <div class="drawer-block">
      <h3>What is counted</h3>
      ${evidenceList([
        'Verified interactions only: a candidate and a recruiter who both confirmed contact happened',
        'Response time measured from the candidate\'s message to the recruiter\'s first substantive reply',
        'Ghosting defined as a conversation the recruiter opened and then abandoned for 21+ days',
        'Satisfaction collected after the outcome is known, from both sides',
      ])}
    </div>
    <div class="drawer-block">
      <h3>What is protected</h3>
      ${evidenceList([
        'No individual conversation is ever shown to anyone',
        'Metrics are suppressed entirely below ten responses',
        'Ranges are shown instead of false precision',
        'A recruiter can see their own metrics and the method, and can contest a figure',
      ])}
    </div>
    <div class="drawer-block">
      <h3>What this is not</h3>
      <p class="small secondary">
        It is not a public rating of a person. Agency recruiters often carry roles whose process they do
        not control, and a weak quarter can reflect an employer rather than the recruiter. The purpose is
        to let a candidate decide how much hope to invest in a conversation — nothing more.
      </p>
    </div>
  `, html`<button type="button" class="btn btn-sm" ${action('close-drawer')}>Close</button>`);
}
