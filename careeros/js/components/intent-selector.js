/**
 * Intent selector. Changing intent is the single most consequential control in
 * the product: it re-frames the dashboard, the ranking and the right rail.
 */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { intents } from '../data/user.js';

export function intentMenu() {
  if (!state.intentMenuOpen) return html``;
  return html`
    <div class="intent-menu" role="dialog" aria-label="Change your active career intent" id="intent-menu">
      <div class="intent-menu-head">
        <p class="eyebrow">Today I am</p>
        <p class="tiny secondary" style="margin-top:4px">
          This changes what the product ranks, not just what it labels. Your dashboard,
          recommendations, feed emphasis and right rail all follow it.
        </p>
      </div>
      <div role="radiogroup" aria-label="Career intent">
        ${intents.map((intent) => html`
          <button type="button" class="intent-option" role="radio"
            aria-checked="${state.intent === intent.id}"
            ${action('set-intent', { intent: intent.id })}>
            <span class="intent-option-label">
              ${intent.label}
              ${state.intent === intent.id ? html`<span class="intent-check" aria-hidden="true">active</span>` : ''}
            </span>
            <span class="intent-option-note">${intent.ranking}</span>
          </button>
        `)}
      </div>
    </div>
  `;
}

/** The left-rail restatement of the active intent, with what it is doing. */
export function intentRail(intent) {
  return html`
    <div class="rail-intent">
      <p class="rail-intent-label">Active intent</p>
      <p class="rail-intent-value">${intent.label}</p>
      <p class="rail-intent-note">${intent.ranking}</p>
      <button type="button" class="btn btn-sm" style="margin-top:9px"
        ${action('toggle-intent-menu')}>Change intent</button>
    </div>
  `;
}
