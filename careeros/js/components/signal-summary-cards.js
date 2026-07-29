/**
 * The four dashboard cards. Each is a doorway into a workflow — never a vanity
 * counter, which is why every one of them navigates somewhere useful.
 */

import { html, action } from '../dom.js';
import { icon } from './icons.js';
import { summaryCards } from '../data/signals.js';

export function signalSummaryCards(intentId) {
  const cards = summaryCards[intentId] || summaryCards['job-hunting'];
  return html`
    <div class="summary-grid">
      ${cards.map((card) => html`
        <button type="button" class="summary-card" ${action('navigate', { route: card.route })}>
          <div class="summary-value">${card.value}</div>
          <div class="summary-label">${card.label}</div>
          <div class="summary-note">${card.note}</div>
          <div class="summary-cta">
            <span>Open</span>${icon('arrowRight', 11)}
          </div>
        </button>
      `)}
    </div>
  `;
}
