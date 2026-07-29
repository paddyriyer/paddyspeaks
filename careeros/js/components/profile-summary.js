/** Left-rail identity, active intent and career goal. */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { user, intentById } from '../data/user.js';
import { avatar, tag } from './primitives.js';
import { intentRail } from './intent-selector.js';

export function profileSummary() {
  const intent = intentById(state.intent);
  return html`
    <section class="card card-pad" aria-label="Your professional identity">
      <div class="identity">
        ${avatar(user.initials, 'lg')}
        <div class="grow">
          <h2 class="identity-name">${user.name}</h2>
          <p class="identity-role">${user.headline}</p>
          <p class="identity-loc">${user.company} · ${user.location}</p>
        </div>
      </div>
      ${intentRail(intent)}
      <button type="button" class="btn btn-sm btn-block" style="margin-top:10px"
        ${action('navigate', { route: 'profile' })}>View your profile</button>
    </section>
  `;
}

export function careerGoal() {
  const g = user.goal;
  return html`
    <section class="card" aria-labelledby="goal-head">
      <div class="card-head"><h3 id="goal-head">Career goal</h3><span class="tiny muted">${g.horizon}</span></div>
      <div class="card-body">
        <p style="font-family:var(--serif);font-size:15px;line-height:1.4;font-weight:600">${g.title}</p>
        <dl class="goal-list" style="margin-top:13px">
          <div class="goal-row">
            <dt>Open to</dt>
            <dd>
              <div class="title-list">${g.openTo.map((t) => tag(t))}</div>
            </dd>
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
