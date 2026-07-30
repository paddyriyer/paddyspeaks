/**
 * "Signal, Not Noise".
 *
 * A notification has to earn its place by naming its professional consequence.
 * The sensitivity control is a first-class part of the panel, and the list of
 * things the product refuses to notify you about is published.
 */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { visibleSignals, sensitivityLevels, notShown } from '../data/signals.js';
import { hiringSignals } from '../data/personas.js';
import { personaFor } from '../data/personas.js';
import { icon } from './icons.js';
import { tag } from './primitives.js';

export function signalNotifications({ limit = 5 } = {}) {
  const persona = personaFor(state.intent, state.hiringView);
  const RANK = { critical: 0, opportunities: 1, conversations: 2, everything: 3 };
  // The user's sensitivity preference, raised to whatever floor this persona
  // needs to be useful at all. visibleSignals() filters internally, so it must
  // be given the effective level rather than the raw stored preference.
  const max = Math.max(RANK[state.signalSensitivity] ?? 1, RANK[persona.sensitivityFloor] ?? 0);
  const effective = Object.keys(RANK).find((k) => RANK[k] === max) || state.signalSensitivity;
  // A hiring manager and a candidate do not want the same alerts.
  // A professional who is not looking must not receive job-search signals at
  // all — the persona promises they are not collected, so showing them would
  // make the product a liar.
  const JOB_SEARCH_KINDS = ['Hiring interest', 'New role', 'Trusted recruiter', 'Skill impact'];
  const all = persona.railMode !== 'career'
    ? hiringSignals.filter((s) => RANK[s.tier] <= max)
    : persona.id === 'professional'
      ? visibleSignals(effective).filter((s) => !JOB_SEARCH_KINDS.includes(s.kind))
      : visibleSignals(effective);
  const shown = all.slice(0, limit);
  const unread = all.filter((s) => !state.readSignals.includes(s.id)).length;
  const level = sensitivityLevels.find((l) => l.id === state.signalSensitivity);

  return html`
    <section class="card" aria-labelledby="signals-head">
      <div class="card-head">
        <div>
          <h3 id="signals-head">Signal, not noise</h3>
          <p class="tiny muted" style="margin-top:2px">${unread} unread of ${all.length} that qualified</p>
        </div>
        <button type="button" class="btn btn-sm btn-quiet" ${action('toggle-expand', { id: 'signal-settings' })}>
          ${icon('filter', 13)}<span>Sensitivity</span>
        </button>
      </div>

      ${state.expanded.includes('signal-settings') ? html`
        <div class="card-body" style="border-bottom:1px solid var(--border);background:var(--surface-sunken)">
          <p class="eyebrow" style="margin-bottom:8px">Signal sensitivity</p>
          <div class="feed-priority" role="radiogroup" aria-label="Signal sensitivity">
            ${sensitivityLevels.map((l) => html`
              <button type="button" class="priority-option" role="radio"
                aria-checked="${state.signalSensitivity === l.id}"
                ${action('set-sensitivity', { level: l.id })}>
                <span class="radio-mark" aria-hidden="true"></span>
                <span>
                  <span style="display:block">${l.label}</span>
                  <span class="tiny muted" style="display:block">${l.note}</span>
                </span>
              </button>
            `)}
          </div>
          <p class="eyebrow" style="margin:14px 0 7px">Never shown, at any sensitivity</p>
          <ul class="notused">${notShown.map((n) => html`<li>${n}</li>`)}</ul>
        </div>
      ` : ''}

      <div class="divide">
        ${shown.map((sig) => signalRow(sig))}
      </div>

      <div class="card-foot">
        Currently showing: <b>${level.label}</b>. ${all.length} of ${9} candidate alerts qualified this week.
        Everything else was discarded rather than queued.
      </div>
    </section>
  `;
}

function signalRow(sig) {
  const read = state.readSignals.includes(sig.id);
  return html`
    <button type="button" class="signal ${read ? '' : 'signal-unread'}"
      ${action('open-signal', { id: sig.id, route: sig.action.route })}>
      <span class="signal-top">
        ${tag(sig.kind, sig.tier === 'critical' ? 'warning' : sig.tier === 'opportunities' ? 'accent' : '')}
        <span class="tiny muted">${sig.when}</span>
      </span>
      <span class="signal-title" style="display:block">${sig.title}</span>
      <span class="signal-detail" style="display:block">${sig.detail}</span>
      <span class="signal-why" style="display:block">Why you are seeing this: ${sig.why}</span>
    </button>
  `;
}
