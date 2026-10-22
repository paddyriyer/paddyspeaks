/* Interactive demo J — Quantum crypto dependency explorer.
 * The facts are in explorer.json; the page lists every primitive as static HTML (all
 * readable without JavaScript), written from that file by
 * scripts/invisible_engine/content/inserts.py. This script turns the list into a picker
 * with a status filter. Tested by invisible-engine/tests/demos.mjs.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  function init() {
    var host = document.getElementById('demo-j');
    if (!host) return;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var picks = host.querySelectorAll('[data-item]'), cards = host.querySelectorAll('[data-card]'), filters = host.querySelectorAll('[data-status]');
    var read = document.getElementById('dj-read'), cur = 'rsa', filter = 'all';
    function render() {
      for (var a = 0; a < picks.length; a++) {
        var st = picks[a].getAttribute('data-st');
        picks[a].hidden = !(filter === 'all' || st === filter);
        picks[a].setAttribute('aria-pressed', picks[a].getAttribute('data-item') === cur ? 'true' : 'false');
      }
      for (var b = 0; b < cards.length; b++) cards[b].hidden = cards[b].getAttribute('data-card') !== cur;
      for (var c = 0; c < filters.length; c++) filters[c].setAttribute('aria-pressed', filters[c].getAttribute('data-status') === filter ? 'true' : 'false');
      var card = host.querySelector('[data-card="' + cur + '"]');
      read.textContent = card ? card.querySelector('h3').textContent + ': ' + card.querySelector('.dj-status').textContent : '';
    }
    host.addEventListener('click', function (ev) {
      var t = ev.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-item')) cur = t.getAttribute('data-item');
      if (t.hasAttribute('data-status')) {
        filter = t.getAttribute('data-status');
        var first = host.querySelector('[data-item][data-st="' + filter + '"]');
        if (filter !== 'all' && first && host.querySelector('[data-item="' + cur + '"]').getAttribute('data-st') !== filter) cur = first.getAttribute('data-item');
      }
      render();
    });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
