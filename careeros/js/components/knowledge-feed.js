/**
 * Knowledge Feed.
 *
 * Tabs by subject, filters by quality attribute, and a priority control that
 * states plainly what it is optimising. Nothing here is ordered by popularity.
 */

import { html, action } from '../dom.js';
import { state, isSaved, isDismissed } from '../store.js';
import { visiblePosts, feedTabs, qualityFilters, feedPriorities, noiseFilter } from '../data/posts.js';
import { personaFor } from '../data/personas.js';
import { icon } from './icons.js';
import { feedPost } from './feed-post.js';
import { emptyState } from './primitives.js';

/** Feed ordering: intent and priority shape it, recency only breaks ties. */
export function rankedPosts() {
  const tab = state.feedTab;
  let list = visiblePosts(personaFor(state.intent, state.hiringView).selfId)
    .filter((p) => !isDismissed(p.id));

  if (tab === 'saved') {
    list = list.filter((p) => isSaved('posts', p.id));
  } else if (tab !== 'for-you') {
    list = list.filter((p) => p.tabs.includes(tab));
  }

  if (state.qualityFilters.length) {
    list = list.filter((p) => state.qualityFilters.every((q) => p.quality.includes(q)));
  }

  if (state.reducedTopics.length) {
    list = list.filter((p) => !state.reducedTopics.includes(p.topic));
  }

  const weight = (p) => {
    let score = p.quality.length * 4;
    if (state.feedPriority === 'opportunities' || state.intent === 'job-hunting') {
      if (p.quality.includes('hiring')) score += 14;
      if (p.conversationHook) score += 8;
    }
    if (state.feedPriority === 'depth' || state.intent === 'learning') {
      if (p.quality.includes('depth')) score += 14;
      if (p.quality.includes('sourced')) score += 6;
    }
    if (state.feedPriority === 'industry') {
      if (p.quality.includes('practitioner')) score += 10;
    }
    if (state.feedPriority === 'network') {
      if (p.tabs.includes('for-you')) score += 8;
    }
    if (p.gapLink) score += 6;
    return score;
  };

  return list.sort((a, b) => weight(b) - weight(a));
}

export function knowledgeFeed({ heading = true, limit = null } = {}) {
  const list = rankedPosts();
  const shown = limit ? list.slice(0, limit) : list;

  return html`
    <section aria-labelledby="feed-head">
      ${heading ? html`
        <div class="section-head">
          <div>
            <h2 class="section-title" id="feed-head">Knowledge feed</h2>
            <p class="small secondary">
              Ordered by what would be useful to you, with the reason attached to every item.
            </p>
          </div>
        </div>
      ` : ''}

      <div class="tabs" role="tablist" aria-label="Feed subjects">
        ${feedTabs.map((t) => html`
          <button type="button" class="tab" role="tab" aria-selected="${state.feedTab === t.id}"
            ${action('set-feed-tab', { tab: t.id })}>${t.label}</button>
        `)}
      </div>

      <div class="filter-row" style="margin:13px 0" role="group" aria-label="Quality filters">
        <span class="eyebrow" style="margin-right:4px">Require</span>
        ${qualityFilters.map((q) => html`
          <button type="button" class="filter-chip" aria-pressed="${state.qualityFilters.includes(q.id)}"
            ${action('toggle-quality', { id: q.id })}>${q.label}</button>
        `)}
        ${state.qualityFilters.length ? html`
          <button type="button" class="btn btn-sm btn-quiet" ${action('clear-quality')}>Clear</button>
        ` : ''}
      </div>

      ${state.reducedTopics.length ? html`
        <div class="dismissed-note" style="margin-bottom:14px">
          <span>Reduced: ${state.reducedTopics.join(', ')}. These topics are down-weighted, not banned.</span>
          <button type="button" class="btn btn-sm" ${action('clear-reduced')}>Undo</button>
        </div>
      ` : ''}

      ${shown.length === 0 ? emptyState(
        state.feedTab === 'saved' ? 'Nothing saved yet' : 'No posts meet those requirements',
        state.feedTab === 'saved'
          ? 'Saved posts collect here. The feed does not pad this space with suggestions.'
          : 'The filters are strict on purpose. Relax one requirement rather than accepting weaker material.',
      ) : html`
        <div class="stack-md">${shown.map((p) => feedPost(p))}</div>
      `}

      ${limit && list.length > limit ? html`
        <button type="button" class="btn btn-block" style="margin-top:14px"
          ${action('navigate', { route: 'knowledge' })}>
          Open the full feed — ${list.length - limit} more that qualified
        </button>
      ` : ''}
    </section>
  `;
}

/** Feed priority control, used in the right rail. */
export function feedPriorityControl() {
  return html`
    <section class="card" aria-labelledby="prio-head">
      <div class="card-head"><h3 id="prio-head">Feed priority</h3></div>
      <div class="card-body">
        <div class="feed-priority" role="radiogroup" aria-label="Feed priority">
          ${feedPriorities.map((p) => html`
            <button type="button" class="priority-option" role="radio"
              aria-checked="${state.feedPriority === p.id}"
              ${action('set-priority', { id: p.id })}>
              <span class="radio-mark" aria-hidden="true"></span>
              <span>${p.label}</span>
            </button>
          `)}
        </div>
      </div>
      <div class="card-foot">
        There is no "most popular" option, because popularity is not a professional signal.
      </div>
    </section>
  `;
}

/** The noise filter, published rather than implied. */
export function noiseFilterPanel({ compact = false } = {}) {
  return html`
    <section class="card" aria-labelledby="noise-head">
      <div class="card-head">
        <h3 id="noise-head">What the feed filters</h3>
        <span class="tiny muted">70 items suppressed today</span>
      </div>
      <div class="card-body">
        <div>
          ${noiseFilter.suppressedToday.map((s) => html`
            <div class="suppressed-row">
              <span class="suppressed-count">${s.count}</span>
              <span class="grow">
                <span style="display:block">${s.label}</span>
                <span class="tiny muted">${s.example}</span>
              </span>
            </div>
          `)}
        </div>

        ${compact ? '' : html`
          <div class="noise-lists" style="margin-top:18px">
            <div class="noise-col noise-demoted">
              <h4 style="color:var(--warning)">Demoted</h4>
              <ul>
                ${noiseFilter.demoted.map((d) => html`<li><span aria-hidden="true">↓</span><span>${d}</span></li>`)}
              </ul>
            </div>
            <div class="noise-col noise-rewarded">
              <h4 style="color:var(--primary)">Rewarded</h4>
              <ul>
                ${noiseFilter.rewarded.map((r) => html`<li><span aria-hidden="true">↑</span><span>${r}</span></li>`)}
              </ul>
            </div>
          </div>
        `}
      </div>
      <div class="card-foot">
        ${icon('info', 12)}
        Suppressed items are down-ranked, not deleted, and the author is never told their post was demoted.
        You can inspect any decision through "Why this post?" on the items that did surface.
      </div>
    </section>
  `;
}
