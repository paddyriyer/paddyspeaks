/* Playground toolbar overflow (PS-06).
   Drives every .pg-overflow in the page: a toggle button plus a menu holding
   the secondary/destructive actions, so the toolbar leads with one primary Run
   instead of a row of equal-weight buttons.

   The buttons inside the menu keep their original ids and are still bound by
   id in sql.js / python.js — this file only shows and hides their container. */
(function () {
  "use strict";

  var groups = [].slice.call(document.querySelectorAll(".pg-overflow"));
  if (!groups.length) return;

  function close(group) {
    var btn = group.querySelector(".pg-overflow-btn");
    var menu = group.querySelector(".pg-overflow-menu");
    if (!btn || !menu) return;
    btn.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  }

  function closeAll(except) {
    groups.forEach(function (g) { if (g !== except) close(g); });
  }

  groups.forEach(function (group) {
    var btn = group.querySelector(".pg-overflow-btn");
    var menu = group.querySelector(".pg-overflow-menu");
    if (!btn || !menu) return;

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = btn.getAttribute("aria-expanded") === "true";
      closeAll(group);
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      menu.hidden = open;
    });

    // Acting on an item is the end of the interaction — let the action's own
    // handler run, then collapse. A disabled item shouldn't close anything.
    menu.addEventListener("click", function (e) {
      var item = e.target.closest("button");
      if (item && !item.disabled) close(group);
      e.stopPropagation();
    });
  });

  document.addEventListener("click", function () { closeAll(null); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    groups.forEach(function (group) {
      var btn = group.querySelector(".pg-overflow-btn");
      if (btn && btn.getAttribute("aria-expanded") === "true") {
        close(group);
        btn.focus();
      }
    });
  });
})();
