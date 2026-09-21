/**
 * JobSignal — alerts, without an inbox.
 *
 * An alert is a saved search. It is stored in this browser and evaluated
 * against the index when the candidate opens the page, which is why Phase 1
 * asks for no email address: there is nothing to send, nothing to leak, and no
 * list to unsubscribe from. Delivery by email is Phase 2, through the Worker
 * that already sends the contact form.
 *
 * "New since last check" is honest about what it means: new to THIS browser
 * since it last looked, measured against each role's first_seen_at, which the
 * pipeline guarantees is never rewritten.
 */
(function (global) {
  'use strict';

  var KEY = 'jsig_alerts_v1';
  var fallback = null;

  function load() {
    if (fallback) return fallback;
    try {
      var raw = localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      fallback = [];
      return fallback;
    }
  }

  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { fallback = list; }
  }

  function uid() {
    return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function add(name, filters) {
    var list = load();
    list.push({
      id: uid(),
      name: String(name || 'Untitled alert').slice(0, 120),
      filters: filters || {},
      created_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
    });
    save(list);
    return list;
  }

  function remove(id) {
    var list = load().filter(function (a) { return a.id !== id; });
    save(list);
    return list;
  }

  function markChecked(id) {
    var list = load();
    list.forEach(function (a) { if (a.id === id) a.last_checked_at = new Date().toISOString(); });
    save(list);
  }

  /** Matches for one alert, plus the subset first seen since it was last opened. */
  function evaluate(alert, jobs) {
    var matches = global.JSSearch.run(jobs, alert.filters || {});
    var since = Date.parse(alert.last_checked_at || '') || 0;
    var fresh = matches.filter(function (j) {
      var t = Date.parse(j.first_seen_at || '');
      return !isNaN(t) && t > since;
    });
    return { matches: matches, fresh: fresh };
  }

  global.JSAlerts = { all: load, add: add, remove: remove, markChecked: markChecked, evaluate: evaluate };
})(window);
