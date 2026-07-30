/**
 * Left-rail identity and focus.
 *
 * This is where the persona is asserted. The identity block, the badge, the
 * focus panel and the overview all come from the active persona, so the rail
 * can never claim "Staff Data Engineer, open to Principal roles" while the
 * workspace beside it is showing candidates to hire.
 */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { intentById } from '../data/user.js';
import { personaFor } from '../data/personas.js';
import { profileFor } from '../data/profiles.js';
import { avatar, tag } from './primitives.js';
import { icon } from './icons.js';
import { intentRail } from './intent-selector.js';

export function profileSummary() {
  const intent = intentById(state.intent);
  const p = personaFor(state.intent, state.hiringView);

  return html`
    <section class="card card-pad" aria-label="Your professional identity">
      <div class="identity">
        ${avatar(p.initials, 'lg')}
        <div class="grow">
          <div class="identity-line">
            <h2 class="identity-name">${p.name}</h2>
            ${tag(p.badge, p.badgeVariant)}
          </div>
          <p class="identity-role">${p.title}</p>
          <p class="identity-loc">${p.org} · ${p.location}</p>
        </div>
      </div>

      ${focusPanel(p)}

      <button type="button" class="btn btn-sm btn-block" style="margin-top:10px"
        ${action('navigate', { route: 'profile' })}>
        ${p.railMode === 'career' ? 'View your profile' : 'View your team'}
      </button>

      ${p.railMode === 'career' ? html`
        <div style="margin-top:10px">${intentRail(intent)}</div>
      ` : ''}
    </section>
  `;
}

/**
 * The focus panel. A job seeker's focus is their goal; a hiring manager's is
 * the requisition they are filling. These are not the same object, and showing
 * one in place of the other is exactly what made the old build ambiguous.
 */
function focusPanel(p) {
  const f = p.focus;
  return html`
    <div class="rail-focus">
      <p class="rail-focus-label">${f.label}</p>
      <p class="rail-focus-headline">${f.headline}</p>
      <ul class="rail-focus-meta">
        ${f.meta.map((m) => html`
          <li>${icon(m.icon, 13)}<span>${m.text}</span></li>
        `)}
      </ul>
      <div class="btn-row" style="margin-top:11px">
        <button type="button" class="btn btn-sm" ${action(f.ctaAction, { id: 'focus' })}>${f.cta}</button>
      </div>
      ${f.secondaryCta ? html`
        <button type="button" class="btn btn-sm btn-block" style="margin-top:8px"
          ${action('set-hiring-view', { view: 'recruiter' })}>
          ${icon('users', 13)}<span>${f.secondaryCta}</span>
        </button>
      ` : ''}
    </div>
  `;
}

/** Role-appropriate numbers. A candidate and a recruiter count different things. */
export function personaOverview() {
  const p = personaFor(state.intent, state.hiringView);
  const o = p.overview;
  return html`
    <section class="card" aria-labelledby="ov-head">
      <div class="card-head">
        <h3 id="ov-head">${o.title}</h3>
        <span class="tiny muted">${o.period}</span>
      </div>
      <div class="card-body">
        <div class="stack-sm">
          ${o.rows.map((r) => html`
            <div class="row-between">
              <span class="small">${r.label}</span>
              <span class="mono" style="font-size:14px;font-weight:700">${r.value}</span>
            </div>
          `)}
        </div>
      </div>
      ${o.note || p.note ? html`<div class="card-foot">${o.note || p.note}</div>` : ''}
    </section>
  `;
}

/** Team activity — only meaningful for the hiring-side personas. */
export function teamActivity() {
  const p = personaFor(state.intent, state.hiringView);
  if (!p.teamActivity) return html``;
  return html`
    <section class="card" aria-labelledby="ta-head">
      <div class="card-head">
        <h3 id="ta-head">${p.id === 'recruiter' ? 'Candidate activity' : 'Team activity'}</h3>
        <button type="button" class="btn btn-sm btn-quiet" ${action('navigate', { route: 'network' })}>View all</button>
      </div>
      <div class="divide">
        ${p.teamActivity.map((t) => html`
          <div class="card-pad" style="padding-top:11px;padding-bottom:11px">
            <div class="row" style="gap:10px;align-items:flex-start">
              ${avatar(t.initials, 'sm')}
              <div class="grow">
                <p class="small"><b>${t.who}</b> ${t.what}</p>
                <p class="tiny muted" style="margin-top:2px">${t.when}</p>
              </div>
            </div>
          </div>
        `)}
      </div>
    </section>
  `;
}

/** Career goal — only for the people who actually have one on record. */
export function careerGoal() {
  const p = personaFor(state.intent, state.hiringView);
  const g = profileFor(p.id).goal;
  // Wei Lin is not looking and Nadia Rhee is not moving. Rendering an empty
  // goal card under their name would be the same fabrication the rest of this
  // prototype argues against.
  if (!g) return html``;
  return html`
    <section class="card" aria-labelledby="goal-head">
      <div class="card-head"><h3 id="goal-head">Career goal</h3><span class="tiny muted">${g.horizon}</span></div>
      <div class="card-body">
        <p style="font-family:var(--serif);font-size:15px;line-height:1.4;font-weight:600">${g.title}</p>
        <dl class="goal-list" style="margin-top:13px">
          <div class="goal-row">
            <dt>Open to</dt>
            <dd><div class="title-list">${g.openTo.map((t) => tag(t))}</div></dd>
          </div>
          <div class="goal-row"><dt>Industries</dt><dd>${g.industries.join(' · ')}</dd></div>
          <div class="goal-row"><dt>Work model</dt><dd>${g.workModel}</dd></div>
          <div class="goal-row"><dt>Geography</dt><dd>${g.geography}</dd></div>
          <div class="goal-row"><dt>Level</dt><dd>${g.level}</dd></div>
        </dl>
        <button type="button" class="btn btn-sm btn-block" style="margin-top:13px"
          ${action('adjust-goal')}>Adjust career goal</button>
      </div>
      <div class="card-foot">
        Your goal is an input to ranking, not a label on your profile. Changing it changes what you are shown.
      </div>
    </section>
  `;
}
