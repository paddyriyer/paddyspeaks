/**
 * PaddySpeaks — local user state (P1.4) and "Continue" history (P1.5).
 *
 *   <script defer src="/lib/ps-state.js"></script>   → window.PSState
 *
 * One small, safe layer over browser storage for every product:
 *
 *   PSState.get(key, fallback)  / set(key, value) / remove(key)
 *       JSON in and out, every call wrapped: a private window, a blocked origin
 *       or a full quota degrades to an in-memory store for the tab instead of
 *       throwing on a page someone is trying to read.
 *
 *   PSState.recordVisit({kind, title, url, label})   last 12 pages, locally
 *   PSState.recent() / PSState.clearRecent()
 *
 *   PSState.summary()     read-only adapters over EXISTING product keys
 *                         (saved jobs, picked questions, Skill Check history)
 *
 *   PSState.inventory() / clear(productId) / clearAll() / exportData()
 *       driven by /data/platform/state-keys.json, the registry of every key
 *       the site writes.
 *
 *   PSState.setSyncAdapter({ push(snapshot), pull() })
 *       The seam for a FUTURE optional account. Nothing calls a server today;
 *       the default adapter does nothing. Products never talk to storage for
 *       sync themselves, so adding sync later is one adapter, not a rewrite.
 *
 * Existing product keys are not renamed or migrated. Nothing here leaves the
 * browser.
 */
(function (global) {
  'use strict';

  var RECENT_KEY = 'ps.recent.v1';
  var RECENT_MAX = 12;
  var memory = {};
  var sync = { push: function () {}, pull: function () { return null; } };

  function store() {
    try { var s = global.localStorage; var t = '__ps_t'; s.setItem(t, '1'); s.removeItem(t); return s; }
    catch (e) { return null; }
  }
  var ls = store();

  function rawGet(key) {
    if (ls) { try { return ls.getItem(key); } catch (e) { /* fall through */ } }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }
  function rawSet(key, val) {
    if (ls) { try { ls.setItem(key, val); return; } catch (e) { /* quota */ } }
    memory[key] = val;
  }

  function get(key, fallback) {
    var raw = rawGet(key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }
  function set(key, value) {
    rawSet(key, JSON.stringify(value));
    try { sync.push({ key: key, value: value }); } catch (e) { /* adapter errors never break a page */ }
  }
  function remove(key) {
    if (ls) { try { ls.removeItem(key); } catch (e) {} }
    delete memory[key];
  }

  /* ── Continue history ─────────────────────────────────────────────── */
  function recordVisit(v) {
    if (!v || !v.url) return;
    var list = get(RECENT_KEY, []);
    if (!Array.isArray(list)) list = [];
    list = list.filter(function (x) { return x && x.url !== v.url; });
    list.unshift({
      kind: String(v.kind || 'page').slice(0, 40),
      title: String(v.title || '').slice(0, 140),
      label: String(v.label || '').slice(0, 80),
      url: String(v.url).slice(0, 300),
      at: new Date().toISOString()
    });
    set(RECENT_KEY, list.slice(0, RECENT_MAX));
  }
  function recent() {
    var l = get(RECENT_KEY, []);
    return Array.isArray(l) ? l.filter(function (x) { return x && typeof x.url === 'string' && x.url.charAt(0) === '/'; }) : [];
  }
  function clearRecent() { remove(RECENT_KEY); }

  /* ── Read-only adapters over existing product keys ───────────────── */
  function summary() {
    var out = { savedJobs: 0, pickedQuestions: 0, skillCheckRuns: 0 };
    var pipe = get('jsig_pipeline_v1', {});
    if (pipe && typeof pipe === 'object') {
      Object.keys(pipe).forEach(function (k) {
        var e = pipe[k];
        if (e && e.stage && e.stage !== 'hidden' && e.stage !== 'rejected') out.savedJobs++;
      });
    }
    var picked = get('qb.set.v1', []);
    if (Array.isArray(picked)) out.pickedQuestions = picked.length;
    else if (picked && typeof picked === 'object') out.pickedQuestions = Object.keys(picked).length;
    var hist = get('ps-history', []);
    if (Array.isArray(hist)) out.skillCheckRuns = hist.length;
    return out;
  }

  /* ── Inventory / clear / export (registry-driven) ────────────────── */
  var registryP = null;
  function registry() {
    if (!registryP) {
      registryP = fetch('/data/platform/state-keys.json', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { products: [] }; })
        .catch(function () { return { products: [] }; });
    }
    return registryP;
  }

  function keysIn(storage) {
    var out = [];
    if (!storage) return out;
    try { for (var i = 0; i < storage.length; i++) out.push(storage.key(i)); } catch (e) {}
    return out;
  }
  function matches(k, spec) { return spec.match === 'prefix' ? k.indexOf(spec.key) === 0 : k === spec.key; }

  function inventory() {
    return registry().then(function (reg) {
      var local = keysIn(ls);
      var sess = keysIn(global.sessionStorage);
      return reg.products.map(function (p) {
        var items = [];
        (p.keys || []).forEach(function (spec) {
          local.filter(function (k) { return matches(k, spec); }).forEach(function (k) {
            var v = rawGet(k) || '';
            items.push({ key: k, what: spec.what, bytes: v.length * 2, sensitive: !!spec.sensitive, area: 'local' });
          });
        });
        (p.session || []).forEach(function (spec) {
          sess.filter(function (k) { return matches(k, spec); }).forEach(function (k) {
            items.push({ key: k, what: spec.what, bytes: 0, sensitive: false, area: 'session' });
          });
        });
        return { id: p.id, label: p.label, items: items };
      });
    });
  }

  function clear(productId) {
    return registry().then(function (reg) {
      reg.products.filter(function (p) { return !productId || p.id === productId; }).forEach(function (p) {
        (p.keys || []).forEach(function (spec) {
          keysIn(ls).filter(function (k) { return matches(k, spec); }).forEach(remove);
        });
        (p.session || []).forEach(function (spec) {
          keysIn(global.sessionStorage).filter(function (k) { return matches(k, spec); }).forEach(function (k) {
            try { global.sessionStorage.removeItem(k); } catch (e) {}
          });
        });
      });
    });
  }

  function exportData() {
    return inventory().then(function (inv) {
      var data = { exported_at: new Date().toISOString(), site: location.origin, products: {} };
      inv.forEach(function (p) {
        p.items.filter(function (i) { return i.area === 'local' && !i.sensitive; }).forEach(function (i) {
          (data.products[p.id] = data.products[p.id] || {})[i.key] = get(i.key, null);
        });
      });
      return data;
    });
  }

  /* ── The "data in this browser" panel (progressive enhancement) ──── */
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function fmtBytes(b) { return b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' KB'; }

  function renderPanel(host) {
    inventory().then(function (inv) {
      var wrap = el('div', { class: 'ps-state-panel' });
      var status = el('p', { class: 'ps-panel-note', role: 'status', 'aria-live': 'polite' });
      var any = inv.some(function (p) { return p.items.length; });
      wrap.appendChild(el('p', null, any
        ? 'This is what this site has stored in this browser right now. It never leaves the browser.'
        : 'This site has nothing stored in this browser right now.'));
      var table = el('table');
      var thead = el('thead');
      var hr = el('tr');
      ['Product', 'What is stored', 'Size', ''].forEach(function (h) { hr.appendChild(el('th', { scope: 'col' }, h)); });
      thead.appendChild(hr); table.appendChild(thead);
      var tb = el('tbody');
      inv.forEach(function (p) {
        if (!p.items.length) return;
        var tr = el('tr');
        tr.appendChild(el('td', null, p.label));
        var what = el('td');
        var seen = {};
        p.items.forEach(function (i) {
          if (seen[i.what]) return; seen[i.what] = 1;
          what.appendChild(el('div', null, i.what + (i.sensitive ? ' (private)' : '')));
        });
        tr.appendChild(what);
        tr.appendChild(el('td', null, fmtBytes(p.items.reduce(function (a, i) { return a + i.bytes; }, 0))));
        var td = el('td');
        var b = el('button', { type: 'button', class: 'ps-btn' }, 'Clear');
        b.setAttribute('aria-label', 'Clear ' + p.label + ' data');
        b.addEventListener('click', function () {
          clear(p.id).then(function () { status.textContent = p.label + ' data cleared.'; renderPanel(host); });
        });
        td.appendChild(b); tr.appendChild(td);
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      if (any) {
        var tw = el('div', { class: 'ps-table-wrap' }); tw.appendChild(table); wrap.appendChild(tw);
        var actions = el('p');
        var exp = el('button', { type: 'button', class: 'ps-btn' }, 'Download a copy (JSON)');
        exp.addEventListener('click', function () {
          exportData().then(function (d) {
            var blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
            var a = el('a', { href: URL.createObjectURL(blob), download: 'paddyspeaks-browser-data.json' });
            document.body.appendChild(a); a.click(); a.remove();
            status.textContent = 'Downloaded. Private items (API key, identity profile) are left out.';
          });
        });
        var all = el('button', { type: 'button', class: 'ps-btn' }, 'Clear everything');
        all.addEventListener('click', function () {
          if (!global.confirm('Clear everything PaddySpeaks has stored in this browser?')) return;
          clear(null).then(function () { status.textContent = 'Everything cleared.'; renderPanel(host); });
        });
        actions.appendChild(exp); actions.appendChild(document.createTextNode(' ')); actions.appendChild(all);
        wrap.appendChild(actions);
      }
      wrap.appendChild(status);
      host.textContent = '';
      host.appendChild(wrap);
    });
  }

  global.PSState = {
    get: get, set: set, remove: remove,
    recordVisit: recordVisit, recent: recent, clearRecent: clearRecent,
    summary: summary, inventory: inventory, clear: clear, clearAll: function () { return clear(null); },
    exportData: exportData,
    setSyncAdapter: function (a) { if (a && typeof a.push === 'function') sync = a; },
    persistent: !!ls
  };

  function start() {
    var hosts = document.querySelectorAll('[data-ps-state-panel]');
    for (var i = 0; i < hosts.length; i++) renderPanel(hosts[i]);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})(typeof window !== 'undefined' ? window : this);
