/* Interactive demo E — Four different connections.
 * The panels are static HTML written from connections.json (all four are shown
 * without JavaScript). This script turns them into tabs: one panel at a time,
 * arrow keys move between tabs (WAI-ARIA tabs pattern).
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  function init() {
    var host = document.getElementById('demo-e');
    if (!host) return;
    var list = host.querySelector('[role="tablist"]');
    if (!list) return;
    list.hidden = false;
    var tabs = list.querySelectorAll('[role="tab"]');
    function select(i, focus) {
      for (var t = 0; t < tabs.length; t++) {
        var on = t === i;
        tabs[t].setAttribute('aria-selected', on ? 'true' : 'false');
        tabs[t].tabIndex = on ? 0 : -1;
        document.getElementById(tabs[t].getAttribute('aria-controls')).hidden = !on;
      }
      if (focus) tabs[i].focus();
    }
    for (var k = 0; k < tabs.length; k++) {
      (function (i) {
        tabs[i].addEventListener('click', function () { select(i, false); });
        tabs[i].addEventListener('keydown', function (e) {
          var n = tabs.length, j = null;
          if (e.key === 'ArrowRight') j = (i + 1) % n;
          else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
          else if (e.key === 'Home') j = 0;
          else if (e.key === 'End') j = n - 1;
          if (j !== null) { e.preventDefault(); select(j, true); }
        });
      })(k);
    }
    select(0, false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
