/* Interactive demo B — Physical card or phone wallet?
 * Highlights one credential's column in the comparison table and shows what
 * each party sees. The table itself is static HTML (works without JS).
 * IEDemoB.VIEWS is tested by invisible-engine/tests/demos.mjs.
 */
(function (root) {
  'use strict';
  var VIEWS = {
    card: {
      label: 'Plastic card',
      parties: [
        ['Merchant (terminal)', 'Receives the card number (PAN), transaction data and a fresh cryptogram it cannot create or reuse.'],
        ['Acquirer and network', 'Route the authorisation request; see the card number and transaction details.'],
        ['Issuer', 'Recomputes and checks the cryptogram with keys derived for this card; sees the full transaction.'],
        ['Cardholder', 'Usually no verification for small payments; a PIN above the regional limit.']
      ]
    },
    wallet: {
      label: 'Phone wallet',
      parties: [
        ['Merchant (terminal)', 'Receives a device token (not the card number), transaction data and a per-transaction cryptogram.'],
        ['Network token service', 'Maps the token to the card account for the issuer; can suspend just this device’s token.'],
        ['Issuer', 'Sees the full transaction, mapped to the cardholder’s account.'],
        ['Cardholder', 'Authenticates on the phone every time (face, finger or passcode) before the secure element releases the cryptogram.']
      ]
    }
  };
  root.IEDemoB = { VIEWS: VIEWS };
  if (typeof document === 'undefined') return;

  function init() {
    var host = document.getElementById('demo-b');
    if (!host) return;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var views = document.getElementById('db-views');
    var btns = host.querySelectorAll('[data-cred]');
    function show(cred) {
      var cells = host.querySelectorAll('[data-col]');
      for (var c = 0; c < cells.length; c++) cells[c].classList.toggle('on', cells[c].getAttribute('data-col') === cred);
      for (var b = 0; b < btns.length; b++) btns[b].setAttribute('aria-pressed', btns[b].getAttribute('data-cred') === cred ? 'true' : 'false');
      views.innerHTML = '';
      VIEWS[cred].parties.forEach(function (p) {
        var d = document.createElement('div');
        var t = document.createElement('b');
        t.textContent = p[0];
        d.appendChild(t);
        d.appendChild(document.createTextNode(p[1]));
        views.appendChild(d);
      });
    }
    for (var k = 0; k < btns.length; k++) btns[k].addEventListener('click', function () { show(this.getAttribute('data-cred')); });
    show('card');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
