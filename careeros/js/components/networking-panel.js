/**
 * "People Who Can Help You Grow" — the replacement for People You May Know.
 *
 * Filtering is by intent, because who is useful depends entirely on what you
 * are trying to do this month.
 */

import { html, action } from '../dom.js';
import { state, isDismissed } from '../store.js';
import { people, matchBasis, candidates } from '../data/people.js';
import { icon } from './icons.js';
import { personRecommendationCard } from './person-recommendation-card.js';
import { candidateCard } from './candidate-card.js';
import { sectionHead, emptyState } from './primitives.js';

const filters = [
  { id: 'everything', label: 'Everything' },
  { id: 'job-hunting', label: 'Job hunting' },
  { id: 'hiring', label: 'Hiring' },
  { id: 'learning', label: 'Learning' },
  { id: 'networking', label: 'Networking' },
  { id: 'mentoring', label: 'Mentoring' },
];

/** People sorted for the active intent: relevance to intent first, then match. */
export function rankedPeople(intentId, filterId) {
  const wanted = filterId === 'everything' ? null : filterId;
  return people
    .filter((p) => !isDismissed(p.id))
    .filter((p) => !wanted || p.intents.includes(wanted))
    .map((p) => ({ ...p, boost: p.intents.includes(intentId) ? 1 : 0 }))
    .sort((a, b) => (b.boost - a.boost) || (b.match - a.match));
}

export function networkingPanel({ intentId, heading = true, limit = null } = {}) {
  // Under the Hiring intent the whole surface becomes candidate-oriented.
  if (intentId === 'hiring') return candidatePanel({ limit, heading });

  const filter = state.networkFilter;
  const list = rankedPeople(intentId, filter);
  const shown = limit ? list.slice(0, limit) : list;
  const dismissedCount = people.filter((p) => isDismissed(p.id)).length;

  return html`
    <section aria-labelledby="net-head">
      ${heading ? sectionHead(
        'People who can help you grow',
        'Ranked on what these people are doing professionally, not on how many contacts you share.',
      ) : ''}

      <div class="filter-row" style="margin-bottom:12px" role="group" aria-label="Filter by intent">
        ${filters.map((f) => html`
          <button type="button" class="filter-chip" aria-pressed="${filter === f.id}"
            ${action('set-network-filter', { filter: f.id })}>
            ${f.label}
            <span class="count">${f.id === 'everything'
              ? people.filter((p) => !isDismissed(p.id)).length
              : people.filter((p) => !isDismissed(p.id) && p.intents.includes(f.id)).length}</span>
          </button>
        `)}
      </div>

      <p class="reason reason-plain" style="margin-bottom:14px">
        ${icon('info', 13)}<span>${matchBasis}</span>
      </p>

      ${shown.length === 0 ? emptyState(
        'Nothing here matches that filter',
        'Rather than pad this list with people who happen to share a contact with you, it is empty. '
        + 'Change the filter, or widen your career goal.',
      ) : html`
        <div class="${limit ? 'stack-md' : 'people-grid'}">
          ${shown.map((p) => personRecommendationCard(p))}
        </div>
      `}

      ${dismissedCount > 0 ? html`
        <div class="dismissed-note" style="margin-top:14px">
          <span>${dismissedCount} recommendation${dismissedCount === 1 ? '' : 's'} dismissed. The signals behind them were down-weighted.</span>
          <button type="button" class="btn btn-sm" ${action('restore-dismissed')}>Restore</button>
        </div>
      ` : ''}
    </section>
  `;
}

function candidatePanel({ limit, heading = true }) {
  const list = candidates.filter((c) => !isDismissed(c.id));
  const shown = limit ? list.slice(0, limit) : list;
  return html`
    <section aria-labelledby="cand-head">
      ${heading ? sectionHead(
        'Candidates worth your attention',
        'Surfaced on demonstrated work, not résumé keyword overlap. Every card says why it appeared.',
      ) : ''}
      <p class="reason reason-plain" style="margin-bottom:14px">
        ${icon('shield', 13)}
        <span>
          Availability signals are only shown where a candidate published them or acted publicly.
          Private browsing behaviour is never exposed to you, in any form.
        </span>
      </p>
      <div class="${limit ? 'stack-md' : 'people-grid'}">
        ${shown.map((c) => candidateCard(c))}
      </div>
    </section>
  `;
}
