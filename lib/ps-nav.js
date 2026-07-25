/**
 * PaddySpeaks — mobile nav toggle (hamburger).
 *
 * Progressive enhancement by design: the button is INJECTED by this script, so
 * with JavaScript disabled no toggle appears and the nav renders exactly as it
 * always has (a wrapped row). Nothing is hidden behind a control that cannot be
 * operated.
 *
 * Why it exists: on a 390px screen the homepage nav wrapped to 5 rows — 268px,
 * about a third of the viewport — pushing real content to ~705px down the page.
 *
 * Accessibility contract:
 *   - a real <button> (not a div), so Enter/Space work for free
 *   - aria-expanded reflects state; aria-controls points at the nav
 *   - Escape closes and returns focus to the button
 *   - a click outside closes it
 *   - the nav is never display:none while open, so focus order stays natural
 *   - search stays reachable: an existing .nav-search-btn is moved beside the
 *     toggle rather than being buried inside the collapsed menu
 */
(function () {
  'use strict';

  var BREAKPOINT = 768;             // matches the site's primary media query
  var nav = document.querySelector('.nav-bar');
  if (!nav) return;

  if (!nav.id) nav.id = 'ps-primary-nav';

  // ── Build the mobile bar: [☰ Menu]  [search] ──
  var bar = document.createElement('div');
  bar.className = 'ps-nav-mobile-bar';

  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'ps-nav-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', nav.id);
  toggle.innerHTML =
    '<span class="ps-nav-toggle-bars" aria-hidden="true"><span></span><span></span><span></span></span>' +
    '<span class="ps-nav-toggle-label">Menu</span>';
  bar.appendChild(toggle);

  // Keep search a first-class action on mobile instead of hiding it in the menu.
  var search = nav.querySelector('.nav-search-btn');
  if (search) bar.appendChild(search);

  nav.parentNode.insertBefore(bar, nav);
  nav.classList.add('ps-nav-collapsible');

  function isMobile() { return window.innerWidth <= BREAKPOINT; }

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function close(returnFocus) {
    if (!nav.classList.contains('is-open')) return;
    setOpen(false);
    if (returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', function () {
    setOpen(!nav.classList.contains('is-open'));
  });

  // Escape closes and hands focus back to the control that opened it.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') close(true);
  });

  // A tap anywhere outside the menu closes it.
  document.addEventListener('click', function (e) {
    if (!nav.classList.contains('is-open')) return;
    if (nav.contains(e.target) || bar.contains(e.target)) return;
    close(false);
  });

  // Following a link should not leave the menu hanging open behind the new page.
  nav.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (a) close(false);
  });

  // Rotating to landscape / resizing past the breakpoint must not leave the nav
  // stuck in its collapsed state on a wide screen.
  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () { if (!isMobile()) close(false); }, 150);
  });
})();
