/** Sticky top navigation: wordmark, sections, conversational search, intent. */

import { html, action, cx } from '../dom.js';
import { icon } from './icons.js';
import { state } from '../store.js';
import { user, intentById } from '../data/user.js';
import { visibleSignals } from '../data/signals.js';

export const sections = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'network', label: 'Network', icon: 'users' },
  { id: 'jobs', label: 'Jobs', icon: 'briefcase' },
  { id: 'knowledge', label: 'Knowledge', icon: 'book' },
  { id: 'messages', label: 'Messages', icon: 'message' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'career-agent', label: 'Career Agent', icon: 'compass' },
];

export function topNavigation() {
  const intent = intentById(state.intent);
  const unread = visibleSignals(state.signalSensitivity)
    .filter((s) => !state.readSignals.includes(s.id)).length;

  return html`
    <header class="topnav">
      <div class="topnav-inner">
        <a class="wordmark" href="#/home" ${action('navigate', { route: 'home' })}>
          <span class="status-dot" aria-hidden="true"></span>
          <span class="wordmark-text">Career<em>OS</em></span>
        </a>

        <nav class="nav-links" aria-label="Primary">
          ${sections.slice(0, 5).map((s) => html`
            <a class="nav-link" href="#/${s.id}" ${action('navigate', { route: s.id })}
              ${state.route === s.id ? 'aria-current="page"' : ''}>${s.label}</a>
          `)}
        </nav>

        <button type="button" class="nav-search" ${action('open-search')}
          aria-label="Search CareerOS. Ask in plain language.">
          ${icon('search', 15)}
          <span class="nav-search-text">Find Staff Data Engineering roles in AI infrastructure, healthcare, California, remote or hybrid</span>
          <kbd>/</kbd>
        </button>

        <div class="nav-right">
          <button type="button" class="icon-btn mobile-search-btn" ${action('open-search')}
            aria-label="Search">${icon('search', 17)}</button>

          <button type="button" class="intent-chip" ${action('toggle-intent-menu')}
            aria-expanded="${state.intentMenuOpen === true}" aria-haspopup="true">
            <span class="intent-chip-label">Today</span>
            <span>${intent.label}</span>
            <span aria-hidden="true" class="muted">⌄</span>
          </button>

          <button type="button" class="${cx('icon-btn')}" ${action('navigate', { route: 'career-agent' })}
            aria-label="${unread} unread signals">
            ${icon('bell', 17)}
            ${unread > 0 ? html`<span class="icon-badge" aria-hidden="true">${unread}</span>` : ''}
          </button>

          <button type="button" class="icon-btn" ${action('navigate', { route: 'messages' })}
            aria-label="Messages, 3 with context prepared">
            ${icon('message', 17)}
            <span class="icon-badge" aria-hidden="true">3</span>
          </button>

          <button type="button" class="avatar" ${action('navigate', { route: 'profile' })}
            aria-label="Your profile, ${user.name}">${user.initials}</button>
        </div>
      </div>
    </header>
  `;
}
