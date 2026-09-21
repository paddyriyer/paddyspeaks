/** Methodology page — chrome only; the content is static markup. */
(function () {
  'use strict';
  window.JSHeader.mount({});
  var foot = document.getElementById('jsFooter');
  if (foot) foot.appendChild(window.JSHeader.footer());
})();
