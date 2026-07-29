/**
 * AppShell: routing, rendering, and the single delegated action dispatcher.
 *
 * There is one listener for clicks and one for keys. Components declare intent
 * with data-action attributes rather than wiring their own handlers, which keeps
 * every state change auditable from one place.
 */

import { html } from './dom.js';
import {
  state, update, subscribe, toggleSaved, toggleConnected, dismiss,
  toggleExpanded, markSignalRead, toggleQualityFilter, reduceTopic, resetAll,
} from './store.js';

import { topNavigation } from './components/top-navigation.js';
import { intentMenu } from './components/intent-selector.js';
import { searchOverlay } from './components/conversational-search.js';
import { explainabilityDrawer } from './components/explainability-drawer.js';
import { messageComposer } from './components/message-composer.js';
import { mobileNavigation } from './components/mobile-navigation.js';

import { homeView } from './views/home.js';
import { networkView } from './views/network.js';
import { jobsView } from './views/jobs.js';
import { knowledgeView } from './views/knowledge.js';
import { messagesView } from './views/messages.js';
import { profileView } from './views/profile.js';
import { careerAgentView } from './views/career-agent.js';
import { searchView } from './views/search.js';
import { philosophyView } from './views/philosophy.js';

const views = {
  home: homeView,
  network: networkView,
  jobs: jobsView,
  knowledge: knowledgeView,
  messages: messagesView,
  profile: profileView,
  'career-agent': careerAgentView,
  search: searchView,
  philosophy: philosophyView,
};

const TITLES = {
  home: 'Home', network: 'Network', jobs: 'Jobs', knowledge: 'Knowledge',
  messages: 'Messages', profile: 'Profile', 'career-agent': 'Career Agent',
  search: 'Search results', philosophy: 'Product philosophy',
};

const root = document.getElementById('app');
const liveRegion = document.getElementById('live-region');

/* ---------- Rendering ---------- */

function render() {
  const view = views[state.route] || homeView;
  root.innerHTML = String(html`
    ${topNavigation()}
    ${intentMenu()}
    <main class="app-body" id="main" tabindex="-1">
      ${view()}
      ${appFooter()}
    </main>
    ${mobileNavigation()}
    ${searchOverlay()}
    ${explainabilityDrawer()}
    ${messageComposer()}
  `);

  document.title = `${TITLES[state.route] || 'Home'} · CareerOS`;

  // Focus the search field the moment the panel opens, as a command palette should.
  if (state.searchOpen) {
    const input = document.getElementById('search-input');
    if (input) { input.focus(); input.select(); }
  }
}

/**
 * Footer. Carries the routes the top bar has no room for, and the disclosure
 * that this is a concept rather than a product.
 */
function appFooter() {
  const links = [
    { route: 'profile', label: 'Profile' },
    { route: 'career-agent', label: 'Career Agent' },
    { route: 'messages', label: 'Messages' },
    { route: 'philosophy', label: 'Product philosophy' },
  ];
  return html`
    <footer class="app-footer">
      <nav class="app-footer-links" aria-label="Secondary">
        ${links.map((l) => html`
          <a href="#/${l.route}" data-action="navigate" data-route="${l.route}">${l.label}</a>
        `)}
      </nav>
      <p class="tiny muted">
        CareerOS is an independent design prototype. All people, companies, roles and metrics shown are
        invented. No branding or visual asset of any existing professional network is used, and it is not
        affiliated with one. Nothing you do here leaves this browser.
      </p>
    </footer>
  `;
}

/** Announce a change that has no visible confirmation of its own. */
function announce(message) {
  if (!liveRegion) return;
  liveRegion.textContent = '';
  // A microtask gap makes repeated identical messages re-announce.
  setTimeout(() => { liveRegion.textContent = message; }, 30);
}

/* ---------- Routing ---------- */

function routeFromHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [route] = raw.split('?');
  return views[route] ? route : 'home';
}

function navigate(route, anchor) {
  update((s) => {
    s.route = route;
    s.drawer = null;
    s.composer = null;
    s.intentMenuOpen = false;
    s.searchOpen = false;
  });
  if (location.hash !== `#/${route}`) {
    history.pushState(null, '', `#/${route}`);
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (anchor) {
    // Wait for the view to paint before scrolling to the deep-linked element.
    requestAnimationFrame(() => {
      const el = document.getElementById(anchor);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        if (!state.expanded.includes(`skill-${anchor}`)) toggleExpanded(`skill-${anchor}`);
      }
    });
  }
}

/* ---------- Action dispatch ---------- */

const handlers = {
  navigate: (d) => navigate(d.route, d.anchor),

  'toggle-intent-menu': () => update((s) => { s.intentMenuOpen = !s.intentMenuOpen; }),

  'set-intent': (d) => {
    update((s) => { s.intent = d.intent; s.intentMenuOpen = false; s.networkFilter = 'everything'; });
    announce(`Intent changed to ${d.intent.replace('-', ' ')}. The dashboard, recommendations and right rail have been re-ranked.`);
  },

  'set-hiring-view': (d) => update((s) => { s.hiringView = d.view; }),

  'open-search': () => update((s) => { s.searchOpen = true; }),
  'close-search-scrim': (d, ev) => {
    if (ev.target.classList.contains('overlay')) update((s) => { s.searchOpen = false; });
  },
  'run-search': (d) => {
    update((s) => { s.searchQuery = d.q; s.searchOpen = false; });
    navigate('search');
  },
  'submit-search': (d, ev) => {
    ev.preventDefault();
    const input = document.getElementById('search-input');
    update((s) => { s.searchQuery = (input && input.value) || ''; s.searchOpen = false; });
    navigate('search');
  },
  'toggle-search-filter': () => announce('Filter toggled. In a working build this re-runs the search and updates the ranking explanation.'),
  'search-action': (d) => {
    if (d.id === 'sa-save') { toggleSaved('searches', 'sq-1'); announce('Search saved with an 85% threshold alert.'); }
    else if (d.id === 'sa-agent') navigate('career-agent');
    else if (d.id === 'sa-intro') navigate('network');
    else announce('Alert created. You will be notified at most once a day, and only for roles that clear the threshold.');
  },

  'toggle-expand': (d) => toggleExpanded(d.id),

  'toggle-reputation': () => {
    update((s) => { s.reputationHidden = !s.reputationHidden; });
    announce(state.reputationHidden
      ? 'Reputation panel hidden. Nothing about your account changes — the score simply is not shown to you.'
      : 'Reputation panel shown.');
  },

  'toggle-save': (d) => {
    const nowSaved = toggleSaved(d.kind, d.id);
    announce(nowSaved ? 'Saved.' : 'Removed from saved.');
  },

  'toggle-connect': (d) => {
    toggleConnected(d.id);
    announce(state.connected.includes(d.id)
      ? 'Connection request sent with your professional context attached.'
      : 'Connection request withdrawn.');
  },

  dismiss: (d) => {
    dismiss(d.id);
    announce('Dismissed. The signals behind this recommendation have been down-weighted.');
  },
  'restore-dismissed': () => {
    update((s) => { s.dismissed = []; });
    announce('Dismissed recommendations restored.');
  },

  'open-drawer': (d) => update((s) => { s.drawer = { kind: d.kind, id: d.id }; }),
  'close-drawer': () => update((s) => { s.drawer = null; }),
  methodology: () => update((s) => { s.drawer = { kind: 'methodology' }; }),
  'ask-agent': (d) => update((s) => { s.drawer = { kind: 'job', id: d.id }; }),

  'open-composer': (d) => update((s) => { s.composer = { personId: d.id, tone: 'peer' }; }),
  'close-composer': () => update((s) => { s.composer = null; }),
  'set-tone': (d) => update((s) => { s.composer = { personId: d.id, tone: d.tone, generic: false }; }),
  'use-generic': (d) => update((s) => { s.composer = { personId: d.id, tone: 'peer', generic: true }; }),
  'send-message': () => {
    update((s) => { s.composer = null; });
    announce('Message sent. It is a single message to one person — there is no bulk send in this product.');
  },
  'edit-draft': () => {},

  'set-feed-tab': (d) => update((s) => { s.feedTab = d.tab; }),
  'toggle-quality': (d) => toggleQualityFilter(d.id),
  'clear-quality': () => update((s) => { s.qualityFilters = []; }),
  'set-priority': (d) => {
    update((s) => { s.feedPriority = d.id; });
    announce('Feed priority changed. The order below has been recomputed.');
  },
  'reduce-topic': (d) => {
    reduceTopic(d.topic);
    announce(`${d.topic} down-weighted. It is reduced, not banned.`);
  },
  'clear-reduced': () => update((s) => { s.reducedTopics = []; }),
  react: (d) => announce(`Marked "${d.reaction}". Reactions here describe what you got from a post, and are visible to the author as feedback rather than as a score.`),
  discuss: () => announce('In a working build this opens the discussion, where comments are ranked by usefulness rather than by recency.'),

  'set-network-filter': (d) => update((s) => { s.networkFilter = d.filter; }),

  'set-sensitivity': (d) => {
    update((s) => { s.signalSensitivity = d.level; });
    announce('Signal sensitivity changed.');
  },
  'open-signal': (d) => {
    markSignalRead(d.id);
    if (d.route) navigate(d.route);
  },

  'signal-more': () => announce('Noted. This signal will be weighted more heavily in future recommendations.'),
  'signal-less': () => announce('Noted. This signal will be weighted less heavily.'),
  'signal-never': () => announce('This signal has been switched off entirely for your account.'),
  'report-rec': () => announce('Reported. Bad recommendations are reviewed by people, and the reviewer sees the same explanation you did.'),

  'strengthen-skill': (d) => {
    announce('In a working build this opens a guided draft that pulls from the work already on your résumé.');
    navigate('career-agent', d.id);
  },
  'feature-article': () => announce('Article featured at the top of your profile, above the summary.'),
  'confirm-mentees': () => announce('Confirmation requests sent to the two mentees. Unconfirmed claims stay private until they respond.'),
  'edit-profile': () => announce('Profile editing is out of scope for this prototype.'),
  'availability-settings': () => announce('Availability is visible to verified recruiters and target-company hiring managers, and never to your current employer.'),
  'adjust-goal': () => announce('Career goal editing is out of scope for this prototype. Changing it would re-rank every surface.'),

  'prepare-application': (d) => announce('Application preparation opens with the two missing evidence items pre-filled, so you address them rather than discover them at interview.'),
  'find-intro': () => navigate('network'),
  'request-intro': (d) => announce('Introduction request drafted. It states what you want and gives the introducer an easy way to decline.'),
  'request-story': () => announce('Request sent to the employer. Roles without a story are ranked no lower — but candidates can see which employers answered.'),
  'request-intro-event': () => announce('Introduction requests drafted for the attendees worth your time.'),
  'add-calendar': () => announce('Added to your calendar with the prepared networking list attached.'),
  'prepare-networking': () => announce('Networking list prepared: four people, with the specific thing you have to say to each.'),
  'community-action': () => announce('In a working build this opens the community, or submits a membership request with your evidence attached.'),
  'start-draft': () => announce('Draft started from your Kubernetes operator work — the material already exists on your résumé.'),
  'next-action': (d) => announce('In a working build this opens the workflow for that action.'),
  'hiring-action': () => announce('In a working build this opens the workflow — the band review, the interviewer rebalance, or the job-description rewrite.'),

  'reset-all': () => {
    resetAll();
    navigate('home');
    announce('Prototype reset to its initial state.');
  },
};

function onClick(ev) {
  const el = ev.target.closest('[data-action]');
  if (!el) {
    // A click outside the intent menu closes it.
    if (state.intentMenuOpen && !ev.target.closest('#intent-menu')) {
      update((s) => { s.intentMenuOpen = false; });
    }
    return;
  }

  const name = el.dataset.action;
  const handler = handlers[name];
  if (!handler) return;

  // Any action other than operating the intent menu dismisses it.
  if (state.intentMenuOpen && name !== 'toggle-intent-menu' && name !== 'set-intent') {
    update((s) => { s.intentMenuOpen = false; });
  }

  // Submit lives on a form; everything else is a click.
  if (name === 'submit-search' && ev.type !== 'submit') return;
  if (el.tagName === 'A' || el.closest('a[data-action]')) ev.preventDefault();

  handler({ ...el.dataset }, ev);
}

function onSubmit(ev) {
  const form = ev.target.closest('form[data-action]');
  if (!form) return;
  const handler = handlers[form.dataset.action];
  if (handler) handler({ ...form.dataset }, ev);
}

function onKeydown(ev) {
  // "/" opens search, the way a command palette should, unless the user is typing.
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName);
  if (ev.key === '/' && !typing && !state.searchOpen) {
    ev.preventDefault();
    update((s) => { s.searchOpen = true; });
    return;
  }
  if (ev.key === 'Escape') {
    if (state.searchOpen || state.drawer || state.composer || state.intentMenuOpen) {
      update((s) => {
        s.searchOpen = false;
        s.drawer = null;
        s.composer = null;
        s.intentMenuOpen = false;
      });
    }
  }
}

/* ---------- Boot ---------- */

update((s) => { s.route = routeFromHash(); });
subscribe(render);
render();

document.addEventListener('click', onClick);
document.addEventListener('submit', onSubmit);
document.addEventListener('keydown', onKeydown);
window.addEventListener('popstate', () => {
  update((s) => { s.route = routeFromHash(); });
});
window.addEventListener('hashchange', () => {
  const route = routeFromHash();
  if (route !== state.route) update((s) => { s.route = route; });
});
