/* Apple Watch health guide: copy and print buttons, and the contents list's
   "you are here" marker. Nothing is hidden until a script runs; without
   JavaScript every section is readable and the buttons simply do nothing. */
(function () {
  'use strict';

  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var el = document.getElementById(b.getAttribute('data-copy'));
      if (!el || !navigator.clipboard) { return; }
      var label = b.textContent;
      navigator.clipboard.writeText(el.textContent).then(function () {
        b.textContent = 'Copied';
        setTimeout(function () { b.textContent = label; }, 1800);
      });
    });
  });

  document.querySelectorAll('[data-print]').forEach(function (b) {
    b.addEventListener('click', function () {
      var target = document.getElementById(b.getAttribute('data-print'));
      if (!target) { return; }
      target.classList.add('print-target');
      document.body.classList.add('print-only');
      var done = function () {
        target.classList.remove('print-target');
        document.body.classList.remove('print-only');
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      window.print();
    });
  });

  var links = Array.prototype.slice.call(document.querySelectorAll('.toc--side a[href^="#"]'));
  var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  if (!links.length) { return; }
  var pending = false;
  function mark() {
    pending = false;
    var line = window.innerHeight * 0.3, current = -1;
    heads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top <= line) { current = i; } });
    links.forEach(function (a, i) {
      if (i === current) { a.setAttribute('aria-current', 'true'); } else { a.removeAttribute('aria-current'); }
    });
  }
  window.addEventListener('scroll', function () {
    if (!pending) { pending = true; window.requestAnimationFrame(mark); }
  }, { passive: true });
  mark();
})();
