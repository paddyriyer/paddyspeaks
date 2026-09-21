/**
 * JobSignal — the candidate's own pipeline.
 *
 * Saved jobs, application stages and hidden roles live in this browser's
 * localStorage and nowhere else. There is no account, no sync and no server
 * copy: JobSignal never learns where anyone applied. That is a privacy
 * position, and it is also why the export button exists — the data is the
 * candidate's, so they can take it.
 *
 * Every read and write is wrapped: a private window, a blocked origin or a
 * full quota degrades to an in-memory store for the tab rather than throwing
 * on a page the candidate is trying to read.
 */
(function (global) {
  'use strict';

  var KEY = 'jsig_pipeline_v1';
  var STAGES = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'hidden'];
  var STAGE_LABEL = {
    saved: 'Saved', applied: 'Applied', interviewing: 'Interviewing',
    offer: 'Offer', rejected: 'Closed', hidden: 'Hidden',
  };
  var fallback = null;

  function load() {
    if (fallback) return fallback;
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      fallback = {};
      return fallback;
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      fallback = state;   // keep the tab working; nothing is lost in-session
    }
  }

  function get(id) { return load()[id] || null; }

  function stageOf(id) {
    var e = get(id);
    return e ? e.stage : '';
  }

  /** Set a stage, or pass '' to forget the job entirely. */
  function set(id, stage, snapshot) {
    var state = load();
    if (!stage) {
      delete state[id];
    } else {
      var prev = state[id] || {};
      state[id] = {
        id: id,
        stage: stage,
        saved_at: prev.saved_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // A snapshot so the dashboard still reads correctly after the role
        // closes and drops out of the index. A closed application is part of
        // the candidate's history whether or not the job still exists.
        title: (snapshot && snapshot.job_title) || prev.title || '',
        company: (snapshot && snapshot.company_name) || prev.company || '',
        company_slug: (snapshot && snapshot.company_slug) || prev.company_slug || '',
        apply_url: (snapshot && snapshot.apply_url) || prev.apply_url || '',
        note: prev.note || '',
      };
    }
    save(state);
    return state[id] || null;
  }

  function setNote(id, note) {
    var state = load();
    if (!state[id]) return null;
    state[id].note = String(note || '').slice(0, 2000);
    state[id].updated_at = new Date().toISOString();
    save(state);
    return state[id];
  }

  function all(stage) {
    var state = load();
    return Object.keys(state)
      .map(function (k) { return state[k]; })
      .filter(function (e) { return !stage || e.stage === stage; })
      .sort(function (a, b) { return (b.updated_at || '').localeCompare(a.updated_at || ''); });
  }

  function counts() {
    var out = {};
    STAGES.forEach(function (s) { out[s] = 0; });
    all().forEach(function (e) { if (out[e.stage] !== undefined) out[e.stage]++; });
    return out;
  }

  function exportBlob() {
    return new Blob([JSON.stringify({
      exported_at: new Date().toISOString(),
      source: 'https://paddyspeaks.com/jobs/',
      entries: all(),
    }, null, 2)], { type: 'application/json' });
  }

  function clearAll() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    fallback = null;
  }

  global.JSTracker = {
    STAGES: STAGES, STAGE_LABEL: STAGE_LABEL,
    get: get, set: set, setNote: setNote, stageOf: stageOf,
    all: all, counts: counts, exportBlob: exportBlob, clearAll: clearAll,
  };
})(window);
