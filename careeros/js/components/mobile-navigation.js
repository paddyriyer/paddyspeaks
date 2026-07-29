/** Bottom navigation for the single-column mobile layout. */

import { html, action } from '../dom.js';
import { icon } from './icons.js';
import { state } from '../store.js';

const items = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'jobs', label: 'Jobs', icon: 'briefcase' },
  { id: 'network', label: 'Network', icon: 'users' },
  { id: 'knowledge', label: 'Knowledge', icon: 'book' },
  { id: 'career-agent', label: 'Agent', icon: 'compass' },
];

export function mobileNavigation() {
  return html`
    <nav class="mobilenav" aria-label="Sections">
      <div class="mobilenav-inner">
        ${items.map((item) => html`
          <a class="mobilenav-link" href="#/${item.id}" ${action('navigate', { route: item.id })}
            ${state.route === item.id ? 'aria-current="page"' : ''}>
            ${icon(item.icon, 19)}
            <span>${item.label}</span>
          </a>
        `)}
      </div>
    </nav>
  `;
}
