/* ═══════════════════════════════════════════════════════════════
   Keyboard shortcuts + the ? cheatsheet (PS-07).

   Ctrl/Cmd+Enter already ran code on both playgrounds, but nothing on
   the page said so, and there was no way to discover anything else. This
   registers the shortcuts in one place and gives them a cheatsheet, so
   the keyboard stops being folklore.

   A page declares what it supports:

     window.PG_SHORTCUTS = [
       { keys: ["Ctrl", "Enter"], label: "Run", target: "pg-run" },
       ...
     ];

   `target` is the id of the button the shortcut activates — the shortcut
   clicks the real control, so behaviour never forks from the button.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const MOD = IS_MAC ? "⌘" : "Ctrl";

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const shortcuts = Array.isArray(window.PG_SHORTCUTS) ? window.PG_SHORTCUTS : [];

  /* Typing in a field must never trigger a bare-letter shortcut. */
  function isTyping(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  }

  function keyHTML(keys) {
    return keys.map(k => `<kbd>${esc(k === "Mod" ? MOD : k)}</kbd>`).join('<span class="pg-kbd-plus">+</span>');
  }

  /* ── Cheatsheet ── */
  let sheet = null;
  let lastFocus = null;

  function build() {
    if (sheet) return sheet;
    sheet = document.createElement("div");
    sheet.className = "pg-sheet-backdrop";
    sheet.hidden = true;
    sheet.innerHTML = `
      <div class="pg-sheet" role="dialog" aria-modal="true" aria-labelledby="pg-sheet-title">
        <div class="pg-sheet-head">
          <h2 id="pg-sheet-title">Keyboard shortcuts</h2>
          <button type="button" class="pg-sheet-close" aria-label="Close shortcuts">✕</button>
        </div>
        <dl class="pg-sheet-list">
          ${shortcuts.map(s => `
            <div class="pg-sheet-row">
              <dt>${keyHTML(s.keys)}</dt>
              <dd>${esc(s.label)}</dd>
            </div>`).join("")}
          <div class="pg-sheet-row">
            <dt>${keyHTML(["?"])}</dt>
            <dd>Open this list</dd>
          </div>
          <div class="pg-sheet-row">
            <dt>${keyHTML(["Esc"])}</dt>
            <dd>Close this list, or any open menu</dd>
          </div>
        </dl>
        <p class="pg-sheet-note">Shortcuts are inert while you are typing in the editor, except ${MOD}+Enter.</p>
      </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest(".pg-sheet-close")) close();
    });
    return sheet;
  }

  function open() {
    build();
    lastFocus = document.activeElement;
    sheet.hidden = false;
    sheet.querySelector(".pg-sheet-close").focus();
  }

  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  function isOpen() { return sheet && !sheet.hidden; }

  /* ── Dispatch ── */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) { e.preventDefault(); close(); return; }

    // "?" opens the sheet from anywhere except a text field.
    if (e.key === "?" && !isTyping(document.activeElement)) {
      e.preventDefault();
      isOpen() ? close() : open();
      return;
    }
    if (isOpen()) return;

    for (const s of shortcuts) {
      const wantsMod = s.keys.includes("Mod") || s.keys.includes("Ctrl");
      const main = s.keys[s.keys.length - 1];
      const hit = wantsMod
        ? (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === main.toLowerCase()
        : !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === main.toLowerCase();
      if (!hit) continue;
      // Bare-letter shortcuts stay out of the way while typing; modifier
      // combinations are expected to work inside the editor.
      if (!wantsMod && isTyping(document.activeElement)) continue;
      const btn = document.getElementById(s.target);
      if (!btn || btn.disabled) continue;
      e.preventDefault();
      btn.click();
      return;
    }
  });

  /* A visible affordance — the audit's point was that none existed. */
  document.addEventListener("DOMContentLoaded", () => {
    if (!shortcuts.length) return;
    const bar = document.querySelector(".pg-editor-toolbar");
    if (!bar || bar.querySelector(".pg-shortcut-hint")) return;
    const hint = document.createElement("button");
    hint.type = "button";
    hint.className = "pg-shortcut-hint";
    hint.setAttribute("aria-haspopup", "dialog");
    hint.innerHTML = `<kbd>?</kbd> shortcuts`;
    hint.addEventListener("click", open);
    const status = bar.querySelector(".pg-status");
    if (status) bar.insertBefore(hint, status); else bar.appendChild(hint);
  });

  window.pgShortcuts = { open, close };
})();
