/**
 * Search results as a research workspace.
 *
 * A chat transcript is a poor container for a career decision. This is the
 * interpretation, the findings grouped by kind, the ranking logic, and the
 * actions worth taking — all on one durable page you can return to.
 */

import { html, action } from '../dom.js';
import { state, isSaved } from '../store.js';
import { searchResult, defaultQuery } from '../data/search.js';
import { icon } from '../components/icons.js';
import { sectionHead, evidenceList, notUsedList, tag } from '../components/primitives.js';

export function searchView() {
  const query = state.searchQuery || defaultQuery;
  const r = searchResult;

  return html`
    <div class="layout-2col">
      <div class="center-stack">
        <header>
          <p class="eyebrow">Research workspace</p>
          <h1 class="display" style="margin-top:8px">Your question, worked through</h1>
          <p class="post-excerpt" style="margin-top:14px">${query}</p>
        </header>

        <section class="card" aria-labelledby="interp-head">
          <div class="card-head">
            <h2 id="interp-head" class="section-title" style="font-size:16px">How the question was read</h2>
            <button type="button" class="btn btn-sm" ${action('open-search')}>Refine</button>
          </div>
          <div class="card-body">
            <dl class="kv">
              <dt>Role</dt><dd>${r.interpretation.role}</dd>
              <dt>Level</dt><dd>${r.interpretation.level}</dd>
              <dt>Geography</dt><dd>${r.interpretation.geography}</dd>
              <dt>Industry</dt><dd>${r.interpretation.industry}</dd>
              <dt>Intent</dt><dd>${r.interpretation.intent}</dd>
            </dl>
            <p class="eyebrow" style="margin:16px 0 7px">Assumptions made</p>
            ${evidenceList(r.interpretation.assumed)}
            <p class="eyebrow" style="margin:14px 0 7px">Assumptions deliberately not made</p>
            ${evidenceList(r.interpretation.notAssumed, 'gap')}
          </div>
          <div class="card-foot">
            An interpretation you can see is an interpretation you can correct. Every assumption above is
            editable, and changing one re-runs the search.
          </div>
        </section>

        <section class="card" aria-labelledby="summ-head">
          <div class="card-head"><h2 id="summ-head" class="section-title" style="font-size:16px">What the answer amounts to</h2></div>
          <div class="card-body">
            <div class="stack-md">
              ${r.summary.map((p) => html`<p style="font-size:14.5px;line-height:1.6">${p}</p>`)}
            </div>
          </div>
        </section>

        <div class="filter-row">
          <span class="eyebrow" style="margin-right:4px">Filters</span>
          ${r.filters.map((f) => html`
            <button type="button" class="filter-chip" aria-pressed="${f.on}"
              ${action('toggle-search-filter', { id: f.id })}>${f.label}</button>
          `)}
        </div>

        ${r.groups.map((group) => html`
          <section aria-labelledby="grp-${group.id}">
            ${sectionHead(group.title, null, html`<span class="tiny mono muted">${group.items.length}</span>`)}
            <div class="card divide">
              ${group.items.map((item) => html`
                <div class="card-pad">
                  <p style="font-size:14px;font-weight:600;line-height:1.4">${item.primary}</p>
                  <p class="small secondary" style="margin-top:3px">${item.secondary}</p>
                  <p class="tiny muted" style="margin-top:3px">${item.meta}</p>
                </div>
              `)}
            </div>
            ${group.excluded ? html`
              <p class="reason reason-plain" style="margin-top:10px">
                ${icon('info', 13)}<span>${group.excluded}</span>
              </p>
            ` : ''}
          </section>
        `)}

        <section class="card" aria-labelledby="rank-head">
          <div class="card-head"><h2 id="rank-head" class="section-title" style="font-size:16px">How these results were ranked</h2></div>
          <div class="card-body">
            ${evidenceList(r.ranking, 'pos')}
            <p class="eyebrow" style="margin:16px 0 7px">Not part of the ranking</p>
            ${notUsedList(r.notRanked)}
          </div>
        </section>
      </div>

      <div class="rail">
        <div class="rail-stack">
          <section class="card" aria-labelledby="sact-head">
            <div class="card-head"><h3 id="sact-head">Recommended next actions</h3></div>
            <div class="divide">
              ${r.actions.map((a) => html`
                <button type="button" class="action-item" ${action('search-action', { id: a.id })}>
                  <span class="action-index">${icon(a.kind === 'alert' ? 'bell' : a.kind === 'save' ? 'bookmark' : a.kind === 'agent' ? 'compass' : 'link', 13)}</span>
                  <span class="action-label grow">${a.label}</span>
                </button>
              `)}
            </div>
          </section>

          <section class="card card-pad">
            <p class="eyebrow">Saved searches</p>
            ${isSaved('searches', 'sq-1') ? html`
              <p class="small secondary" style="margin-top:8px">
                Saved. You will be alerted when a healthcare AI platform role above 85% appears — at most
                one notification a day, and never a digest of things that do not qualify.
              </p>
              ${tag('Alert active', 'primary')}
            ` : html`
              <p class="small secondary" style="margin-top:8px">
                Saving a search creates an alert with a threshold, not a daily digest. Nothing arrives
                unless it clears the bar.
              </p>
              <button type="button" class="btn btn-sm btn-block" style="margin-top:11px"
                ${action('toggle-save', { kind: 'searches', id: 'sq-1' })}>Save this search</button>
            `}
          </section>
        </div>
      </div>
    </div>
  `;
}
