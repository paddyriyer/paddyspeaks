/**
 * JobSignal — tiny DOM builder.
 *
 * Every string rendered by this product is third-party text from an employer's
 * job description. None of it is ever assigned to innerHTML: elements are
 * built and text is set with textContent, so a description containing markup
 * is displayed, not executed. A test in jobsignal/tests/test_pipeline.py fails
 * the build if any file under jobs/js/ assigns innerHTML.
 */
(function (global) {
  'use strict';

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function mount(node, children) {
    clear(node);
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c) node.appendChild(c);
    });
    return node;
  }

  global.JSDom = { el: el, clear: clear, mount: mount };
})(window);
