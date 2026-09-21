/**
 * JobSignal — data access.
 *
 * Everything the pages render comes from the static files the ingestion
 * pipeline commits (jobs/data/*). There is no API call and no server-side
 * rendering: GitHub Pages serves JSON from the same CDN as the HTML, so a
 * search is one download and then pure local work.
 *
 * The index is cached in sessionStorage for the tab's lifetime. It is keyed by
 * the file's own generated_at, so a fresh ingestion run invalidates it without
 * anyone having to remember to bump a version.
 */
(function (global) {
  'use strict';

  var BASE = '/jobs/data/';
  var CACHE_KEY = 'jsig_index_v1';
  var memory = {};

  function fetchJSON(path) {
    if (memory[path]) return memory[path];
    memory[path] = fetch(BASE + path, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status);
      return r.json();
    });
    return memory[path];
  }

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeCache(doc) {
    // Best-effort: a private window or a full quota must never break the page.
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(doc)); } catch (e) { /* ignore */ }
  }

  function index() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    return fetchJSON('index.json').then(function (doc) {
      writeCache(doc);
      return doc;
    });
  }

  function stats() { return fetchJSON('stats.json'); }
  function companies() { return fetchJSON('companies.json'); }
  function health() { return fetchJSON('health.json'); }

  /** Full record for one job id, from its detail shard. */
  function job(id) {
    if (!id || id.length < 3) return Promise.resolve(null);
    return fetchJSON('detail/' + id.slice(1, 3) + '.json').then(function (doc) {
      var found = null;
      (doc.jobs || []).forEach(function (j) { if (j.id === id) found = j; });
      return found;
    }).catch(function () { return null; });
  }

  global.JSData = {
    index: index, stats: stats, companies: companies, health: health, job: job,
  };
})(window);
