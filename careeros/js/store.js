/**
 * Application state.
 *
 * Everything the user chooses persists to localStorage so the prototype
 * remembers intent, saved items, dismissals and feed preferences across
 * reloads. There is no backend and no network call anywhere in this app.
 */

const KEY = 'careeros-state-v1';

const DEFAULT_STATE = {
  route: 'home',
  intent: 'job-hunting',
  hiringView: 'manager', // 'manager' | 'recruiter' — only used under the Hiring intent
  saved: { people: [], jobs: [], posts: [], events: [], searches: [] },
  connected: [],
  dismissed: [],
  readSignals: [],
  signalSensitivity: 'opportunities',
  feedTab: 'for-you',
  feedPriority: 'balanced',
  qualityFilters: [],
  reducedTopics: [],
  networkFilter: 'everything',
  reputationHidden: false,
  expanded: [], // ids of open "Why this?" panels
  drawer: null, // { kind, id }
  composer: null, // { personId, tone }
  intentMenuOpen: false,
  searchOpen: false,
  searchQuery: '',
  onboardingSeen: false,
  // Dashboard layouts, keyed by persona id. A hiring manager's arrangement is
  // not a job seeker's, so they are stored separately rather than globally.
  layouts: {},
  customising: false,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function load() {
  const base = clone(DEFAULT_STATE);
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    // Merge shallowly, one level deep for `saved`, so a schema addition in a
    // later version does not wipe a returning user's choices.
    const merged = { ...base, ...stored };
    merged.saved = { ...base.saved, ...(stored.saved || {}) };
    // Transient UI state should never be restored from a previous session.
    merged.drawer = null;
    merged.composer = null;
    merged.searchOpen = false;
    merged.intentMenuOpen = false;
    merged.customising = false;
    merged.layouts = { ...(stored.layouts || {}) };
    merged.expanded = [];
    return merged;
  } catch {
    return base;
  }
}

const PERSIST_KEYS = [
  'intent', 'hiringView', 'saved', 'connected', 'dismissed', 'readSignals',
  'signalSensitivity', 'feedTab', 'feedPriority', 'qualityFilters',
  'reducedTopics', 'networkFilter', 'reputationHidden', 'onboardingSeen',
  'layouts',
];

export const state = load();

const listeners = new Set();

/** Subscribe to state changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Apply a mutation, persist the durable slice, and notify subscribers. */
export function update(mutator) {
  mutator(state);
  persist();
  listeners.forEach((fn) => fn(state));
}

function persist() {
  try {
    const slice = {};
    PERSIST_KEYS.forEach((key) => { slice[key] = state[key]; });
    localStorage.setItem(KEY, JSON.stringify(slice));
  } catch {
    // Private-browsing mode or a full quota: the prototype still works, it
    // simply forgets. No user-facing error is warranted.
  }
}

/* ---------- Collection helpers ---------- */

export function isSaved(kind, id) {
  return (state.saved[kind] || []).includes(id);
}

export function toggleSaved(kind, id) {
  update((s) => {
    const list = s.saved[kind] || (s.saved[kind] = []);
    const at = list.indexOf(id);
    if (at === -1) list.push(id); else list.splice(at, 1);
  });
  return isSaved(kind, id);
}

export function isConnected(id) {
  return state.connected.includes(id);
}

export function toggleConnected(id) {
  update((s) => {
    const at = s.connected.indexOf(id);
    if (at === -1) s.connected.push(id); else s.connected.splice(at, 1);
  });
}

export function isDismissed(id) {
  return state.dismissed.includes(id);
}

export function dismiss(id) {
  update((s) => { if (!s.dismissed.includes(id)) s.dismissed.push(id); });
}

export function restore(id) {
  update((s) => {
    const at = s.dismissed.indexOf(id);
    if (at !== -1) s.dismissed.splice(at, 1);
  });
}

export function isExpanded(id) {
  return state.expanded.includes(id);
}

export function toggleExpanded(id) {
  update((s) => {
    const at = s.expanded.indexOf(id);
    if (at === -1) s.expanded.push(id); else s.expanded.splice(at, 1);
  });
}

export function markSignalRead(id) {
  update((s) => { if (!s.readSignals.includes(id)) s.readSignals.push(id); });
}

export function toggleQualityFilter(id) {
  update((s) => {
    const at = s.qualityFilters.indexOf(id);
    if (at === -1) s.qualityFilters.push(id); else s.qualityFilters.splice(at, 1);
  });
}

export function reduceTopic(topic) {
  update((s) => { if (!s.reducedTopics.includes(topic)) s.reducedTopics.push(topic); });
}

/* ---------- Dashboard layout ---------- */

/** The stored layout for a persona, or null if they have not customised it. */
export function storedLayout(personaId) {
  return state.layouts[personaId] || null;
}

export function setLayout(personaId, layout) {
  update((s) => { s.layouts[personaId] = layout; });
}

export function resetLayout(personaId) {
  update((s) => { delete s.layouts[personaId]; });
}

export function hasCustomLayout(personaId) {
  return Boolean(state.layouts[personaId]);
}

/** Reset everything — used by the "start over" control on the philosophy view. */
export function resetAll() {
  const base = clone(DEFAULT_STATE);
  update((s) => { Object.assign(s, base); });
}
