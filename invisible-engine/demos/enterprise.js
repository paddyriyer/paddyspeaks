/* Interactive demo L — Enterprise risk walk-through.
 * The facts are in enterprise.json; every scenario is static HTML in the page (all
 * readable without JavaScript), written from that file by
 * scripts/invisible_engine/content/inserts.py. This script shows one scenario at a time
 * and filters its controls by category. Tested by invisible-engine/tests/demos.mjs.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  function init() {
    var host = document.getElementById('demo-l');
    if (!host) return;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var scen = host.querySelectorAll('[data-scen]'), cats = host.querySelectorAll('[data-cat-btn]');
    var read = document.getElementById('dl-read'), cur = 'visitor', cat = 'all';
    function render() {
      for (var a = 0; a < scen.length; a++) scen[a].setAttribute('aria-pressed', scen[a].getAttribute('data-scen') === cur ? 'true' : 'false');
      for (var b = 0; b < cats.length; b++) cats[b].setAttribute('aria-pressed', cats[b].getAttribute('data-cat-btn') === cat ? 'true' : 'false');
      var panels = host.querySelectorAll('[data-panel]'), shownRows = 0;
      for (var c = 0; c < panels.length; c++) {
        var on = panels[c].getAttribute('data-panel') === cur;
        panels[c].hidden = !on;
        var rows = panels[c].querySelectorAll('[data-cat]');
        for (var r = 0; r < rows.length; r++) {
          var vis = cat === 'all' || rows[r].getAttribute('data-cat') === cat;
          rows[r].hidden = !vis;
          if (on && vis) shownRows++;
        }
      }
      var label = host.querySelector('[data-scen="' + cur + '"]').textContent;
      read.textContent = label + ': ' + shownRows + ' recommendation' + (shownRows === 1 ? '' : 's') + (cat === 'all' ? '' : ' in this category') + ', each with who can carry it out.';
    }
    host.addEventListener('click', function (ev) {
      var t = ev.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-scen')) cur = t.getAttribute('data-scen');
      if (t.hasAttribute('data-cat-btn')) cat = t.getAttribute('data-cat-btn');
      render();
    });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
