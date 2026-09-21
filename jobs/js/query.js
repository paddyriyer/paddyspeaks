/**
 * JobSignal — filter state <-> query string.
 *
 * The URL is the single source of truth for a search, so every result set is
 * shareable and the back button does what a candidate expects.
 */
(function (global) {
  'use strict';

  var BOOLS = ['verified6h', 'salaryOnly', 'directOnly', 'hideStaffing',
    'hideReposted', 'visa', 'clearanceFree', 'includeUnverified'];
  var STRINGS = ['q', 'location', 'company', 'remote', 'level', 'employment',
    'industry', 'size', 'education', 'sort'];
  var NUMBERS = ['postedDays', 'minSalary'];

  function read(search) {
    var p = new URLSearchParams(search === undefined ? global.location.search : search);
    var f = {};
    STRINGS.forEach(function (k) { if (p.get(k)) f[k] = p.get(k); });
    NUMBERS.forEach(function (k) {
      var v = parseInt(p.get(k) || '', 10);
      if (!isNaN(v)) f[k] = v;
    });
    BOOLS.forEach(function (k) { if (p.get(k) === '1') f[k] = true; });
    return f;
  }

  function write(f) {
    var p = new URLSearchParams();
    STRINGS.forEach(function (k) { if (f[k]) p.set(k, f[k]); });
    NUMBERS.forEach(function (k) { if (f[k]) p.set(k, String(f[k])); });
    BOOLS.forEach(function (k) { if (f[k]) p.set(k, '1'); });
    return p.toString();
  }

  function push(f) {
    var qs = write(f);
    var url = global.location.pathname + (qs ? '?' + qs : '');
    global.history.replaceState(null, '', url);
  }

  global.JSQuery = { read: read, write: write, push: push, BOOLS: BOOLS, STRINGS: STRINGS, NUMBERS: NUMBERS };
})(window);
