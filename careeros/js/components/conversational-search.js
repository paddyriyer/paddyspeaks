/**
 * Command-style search panel. Natural-language questions in; a research
 * workspace out (see views/search.js).
 */

import { html, action } from '../dom.js';
import { icon } from './icons.js';
import { state } from '../store.js';
import { exampleQueries, defaultQuery } from '../data/search.js';

export function searchOverlay() {
  if (!state.searchOpen) return html``;
  return html`
    <div class="overlay" ${action('close-search-scrim')}>
      <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search CareerOS">
        <form class="search-input-row" ${action('submit-search')}>
          ${icon('search', 17)}
          <input class="search-input" id="search-input" name="q" type="text"
            autocomplete="off" value="${state.searchQuery}"
            placeholder="Find Staff Data Engineering roles in AI infrastructure, healthcare, California, remote or hybrid"
            aria-label="Ask in plain language">
          <button type="submit" class="btn btn-primary btn-sm">Search</button>
        </form>

        <div class="search-section">
          <p class="search-section-label">Try a question, not keywords</p>
          ${exampleQueries.map((q) => html`
            <button type="button" class="search-option" ${action('run-search', { q })}>
              ${icon('search', 14)}
              <span>${q}</span>
            </button>
          `)}
        </div>

        <div class="search-section" style="border-top:1px solid var(--border)">
          <p class="search-section-label">Or describe the whole situation</p>
          <button type="button" class="search-option" ${action('run-search', { q: defaultQuery })}>
            ${icon('layers', 14)}
            <span>${defaultQuery}</span>
          </button>
        </div>

        <div class="search-foot">
          <span>Enter to search</span>
          <span>Esc to close</span>
          <span>Results are ranked on demonstrated work, and the ranking is shown to you</span>
        </div>
      </div>
    </div>
  `;
}
