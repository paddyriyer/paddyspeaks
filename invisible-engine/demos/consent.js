/* Interactive demo K — Consent vs confidentiality.
 * The facts are in consent.json; the static table and both scenarios in the page are
 * written from the same file by scripts/invisible_engine/content/inserts.py. This script
 * adds the two choices (scenario, protection) and highlights the matching column and
 * story. Tested by invisible-engine/tests/demos.mjs.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  function init() {
    var host = document.getElementById('demo-k');
    if (!host) return;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var scen = host.querySelectorAll('[data-scen]'), lev = host.querySelectorAll('[data-level]');
    var read = document.getElementById('dk-read');
    var cur = { scen: 'lost', level: 'e2e' };
    function render() {
      for (var a = 0; a < scen.length; a++) scen[a].setAttribute('aria-pressed', scen[a].getAttribute('data-scen') === cur.scen ? 'true' : 'false');
      for (var b = 0; b < lev.length; b++) lev[b].setAttribute('aria-pressed', lev[b].getAttribute('data-level') === cur.level ? 'true' : 'false');
      var cells = host.querySelectorAll('#dk-table [data-col]');
      for (var c = 0; c < cells.length; c++) cells[c].classList.toggle('on', cells[c].getAttribute('data-col') === cur.level);
      var stories = host.querySelectorAll('[data-story]');
      for (var s = 0; s < stories.length; s++) stories[s].classList.toggle('on', stories[s].getAttribute('data-story') === cur.scen);
      var holder = host.querySelector('#dk-table tr[data-reader="holder"] td[data-col="' + cur.level + '"]');
      var levLabel = host.querySelector('[data-level="' + cur.level + '"]').textContent;
      var located = host.querySelector('[data-story="' + cur.scen + '"]').getAttribute('data-located');
      var sees = holder && holder.classList.contains('v-yes');
      read.textContent = levLabel + ': the account holder ' + (sees ? 'can still read' : 'cannot read') + ' the location of ' + located +
        '. Encryption changes who else can read it; it does not change who agreed.';
    }
    for (var k = 0; k < scen.length; k++) scen[k].addEventListener('click', function () { cur.scen = this.getAttribute('data-scen'); render(); });
    for (var m = 0; m < lev.length; m++) lev[m].addEventListener('click', function () { cur.level = this.getAttribute('data-level'); render(); });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
