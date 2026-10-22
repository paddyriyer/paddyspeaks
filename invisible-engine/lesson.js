/* The Invisible Engine — reader levels, scene frames, jump list.
 *
 * Without this script every level is shown and each diagram appears as an
 * <img> in its final state, with the frame captions in the page text. With it:
 *   - body[data-level] shows one reader level (A–E) or all of them;
 *   - each scene's SVG (its phone-vertical twin on a narrow screen) is fetched and inlined, so its <g data-f="n"> layers can
 *     be revealed one frame at a time with Back / Next (nothing plays by itself);
 *   - a jump list moves between scenes.
 * The chosen level is the only thing stored: localStorage "ie.level".
 */
(function () {
  'use strict';
  var KEY = 'ie.level';
  var LEVELS = ['A', 'B', 'C', 'D', 'E', 'all'];
  var LABEL = { A: 'For a ten-year-old', B: 'For a curious adult', C: 'For an engineering student', D: 'For a security architect', E: 'For a CISO', all: 'All levels' };

  function readLevel() {
    try { var v = localStorage.getItem(KEY); return LEVELS.indexOf(v) >= 0 ? v : null; } catch (e) { return null; }
  }
  function saveLevel(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: fine */ } }

  function setLevel(v) {
    if (LEVELS.indexOf(v) < 0) v = 'all';
    if (v === 'all') document.body.removeAttribute('data-level');
    else document.body.setAttribute('data-level', v);
    var radios = document.querySelectorAll('input[name="ie-level"]');
    for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === v;
  }

  function buildSwitch() {
    var host = document.querySelector('[data-ie-levels]');
    if (!host) return;
    var fs = document.createElement('fieldset');
    var lg = document.createElement('legend');
    lg.textContent = 'Read as';
    fs.appendChild(lg);
    LEVELS.forEach(function (v) {
      var lab = document.createElement('label');
      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = 'ie-level'; inp.value = v;
      inp.addEventListener('change', function () { setLevel(v); saveLevel(v); });
      lab.appendChild(inp);
      lab.appendChild(document.createTextNode(v === 'all' ? 'All' : v));
      lab.title = LABEL[v];
      var sr = document.createElement('span');
      sr.className = 'sr';
      sr.textContent = ' — ' + LABEL[v];
      lab.appendChild(sr);
      fs.appendChild(lab);
    });
    host.insertBefore(fs, host.firstChild);
    setLevel(readLevel() || 'all');

    var scenes = document.querySelectorAll('.scene[id], .demo[id]');
    if (scenes.length > 1) {
      var wrap = document.createElement('label');
      wrap.className = 'jump';
      var sel = document.createElement('select');
      sel.setAttribute('aria-label', 'Jump to a scene');
      var o0 = document.createElement('option');
      o0.value = ''; o0.textContent = 'Jump to a scene…';
      sel.appendChild(o0);
      for (var i = 0; i < scenes.length; i++) {
        var o = document.createElement('option');
        var h = scenes[i].querySelector('h2');
        var n = scenes[i].querySelector('.scene-n');
        o.value = scenes[i].id;
        o.textContent = (n ? n.textContent.replace(/\s+/g, ' ').trim() + ' · ' : '') + (h ? h.textContent : scenes[i].id);
        sel.appendChild(o);
      }
      sel.addEventListener('change', function () {
        if (!sel.value) return;
        var t = document.getElementById(sel.value);
        if (t) { t.scrollIntoView(); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); history.replaceState(null, '', '#' + sel.value); }
        sel.value = '';
      });
      wrap.appendChild(sel);
      host.appendChild(wrap);
    }
  }

  /* ── frames ── */
  function frameCount(svg) {
    var max = 0, g = svg.querySelectorAll('[data-f]');
    for (var i = 0; i < g.length; i++) max = Math.max(max, parseInt(g[i].getAttribute('data-f'), 10) || 0);
    return max;
  }

  function wireScene(viz, svg) {
    var total = frameCount(svg);
    var ctl = viz.querySelector('.ctl');
    var list = viz.querySelectorAll('.frames li');
    if (!total || !ctl) return;
    var back = ctl.querySelector('[data-act="back"]');
    var next = ctl.querySelector('[data-act="next"]');
    var all = ctl.querySelector('[data-act="all"]');
    var count = ctl.querySelector('.count');
    var live = viz.querySelector('.live');
    var cur = 1;
    function show(n, announce) {
      cur = Math.max(1, Math.min(total, n));
      var g = svg.querySelectorAll('[data-f]');
      for (var i = 0; i < g.length; i++) {
        var f = parseInt(g[i].getAttribute('data-f'), 10) || 0;
        g[i].classList.toggle('ie-off', f > cur);
      }
      for (var j = 0; j < list.length; j++) {
        list[j].classList.toggle('on', j === cur - 1);
        list[j].classList.toggle('seen', j < cur - 1);
        if (j === cur - 1) list[j].setAttribute('aria-current', 'step'); else list[j].removeAttribute('aria-current');
      }
      back.disabled = cur <= 1;
      next.disabled = cur >= total;
      count.textContent = 'Frame ' + cur + ' of ' + total;
      if (announce && live && list[cur - 1]) live.textContent = 'Frame ' + cur + ': ' + list[cur - 1].textContent;
    }
    back.addEventListener('click', function () { show(cur - 1, true); });
    next.addEventListener('click', function () { show(cur + 1, true); });
    all.addEventListener('click', function () { show(total, true); });
    for (var k = 0; k < list.length; k++) {
      (function (idx) {
        list[idx].addEventListener('click', function () { show(idx + 1, true); });
      })(k);
    }
    ctl.hidden = false;
    show(1, false);
  }

  function inline(viz) {
    var img = viz.querySelector('img[data-svg]');
    if (!img || !window.fetch || !window.DOMParser) return;
    // A phone-vertical twin, when the page offers one and the screen is narrow.
    var pic = img.parentNode.nodeName.toLowerCase() === 'picture' ? img.parentNode : null;
    var alt = pic && pic.querySelector('source[srcset]');
    var url = alt && window.matchMedia && window.matchMedia(alt.getAttribute('media')).matches ? alt.getAttribute('srcset') : img.getAttribute('src');
    fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      var svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return;
      var bad = svg.querySelectorAll('script, foreignObject');
      for (var i = 0; i < bad.length; i++) bad[i].parentNode.removeChild(bad[i]);
      var node = document.importNode(svg, true);
      node.setAttribute('role', 'img');
      var t = node.querySelector('title'), d = node.querySelector('desc');
      var id = (img.getAttribute('data-svg') || 'svg').replace(/[^\w-]/g, '');
      if (t) { t.id = id + '-t'; }
      if (d) { d.id = id + '-d'; }
      if (t) node.setAttribute('aria-labelledby', id + '-t' + (d ? ' ' + id + '-d' : ''));
      node.removeAttribute('width'); node.removeAttribute('height');
      (pic || img).parentNode.replaceChild(node, pic || img);
      wireScene(viz, node);
    }).catch(function () { /* keep the static image: every frame visible */ });
  }

  function init() {
    buildSwitch();
    var v = document.querySelectorAll('.viz');
    for (var i = 0; i < v.length; i++) inline(v[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
