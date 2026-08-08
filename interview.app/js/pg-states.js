/* ═══════════════════════════════════════════════════════════════
   Shared loading + empty states for the playgrounds (PS-05, PS-08).

   Two problems this replaces:

   1. Loading was a single line of text in the toolbar. The SQL and Python
      engines are 10–14 MB of WebAssembly; for several seconds the results
      pane sat empty with no indication anything was happening.
   2. Empty states were one italic sentence ("Run a query to see results."),
      which says what is missing but not why, or what to do about it.

   Progress here is by completed step, not a fabricated percentage — the
   loaders do not report byte progress, and inventing one would be a lie
   told in a progress bar.
   ═══════════════════════════════════════════════════════════════ */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Render the boot skeleton into a results pane.
 * `steps` are the real milestones the caller will report as it hits them.
 */
export function renderBoot(el, { engine, size, steps }) {
  if (!el) return;
  el.innerHTML = `
    <div class="pg-boot" role="status" aria-live="polite">
      <p class="pg-boot-title">Starting the ${esc(engine)} engine</p>
      <p class="pg-boot-note">${esc(size)} on the first visit, then cached by your browser. You can write code while it loads — Run turns on by itself.</p>
      <div class="pg-boot-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="0" aria-label="Engine startup progress">
        <span class="pg-boot-fill" style="width:0%"></span>
      </div>
      <p class="pg-boot-step">Step 1 of ${steps.length} · ${esc(steps[0])}</p>
      <div class="pg-skel" aria-hidden="true"><span></span><span></span><span></span></div>
    </div>`;
  el._pgSteps = steps;
}

/** Advance the boot skeleton to step `n` (1-based). */
export function bootStep(el, n) {
  if (!el) return;
  const steps = el._pgSteps || [];
  const bar = el.querySelector('.pg-boot-bar');
  const fill = el.querySelector('.pg-boot-fill');
  const label = el.querySelector('.pg-boot-step');
  if (!bar || !fill || !label || !steps[n - 1]) return;
  fill.style.width = `${Math.round((n / steps.length) * 100)}%`;
  bar.setAttribute('aria-valuenow', String(n));
  label.textContent = `Step ${n} of ${steps.length} · ${steps[n - 1]}`;
}

/** Boot failed. Say what broke and what the reader can actually try. */
export function renderBootError(el, message, tries) {
  if (!el) return;
  el.innerHTML = `
    <div class="pg-state pg-state-error" role="alert">
      <p class="pg-state-title">The engine did not start</p>
      <p class="pg-state-body">${esc(message)}</p>
      ${tries && tries.length ? `<ul class="pg-state-list">${tries.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="pg-state-actions">
        <button type="button" class="pg-btn pg-btn-primary" onclick="location.reload()">Reload the page</button>
      </div>
    </div>`;
}

/**
 * An empty state that earns its space: what is empty, why it is empty, and
 * the one thing worth doing next. `action` is optional and, when given,
 * points at a button that already exists on the page.
 */
export function renderEmpty(el, { title, body, hint, action }) {
  if (!el) return;
  el.innerHTML = `
    <div class="pg-state">
      <p class="pg-state-title">${esc(title)}</p>
      ${body ? `<p class="pg-state-body">${esc(body)}</p>` : ''}
      ${hint ? `<p class="pg-state-hint">${hint}</p>` : ''}
      ${action ? `<div class="pg-state-actions">
        <button type="button" class="pg-btn pg-btn-primary" data-pg-trigger="${esc(action.target)}">${esc(action.label)}</button>
      </div>` : ''}
    </div>`;
}

/* One delegated listener: an empty state's call to action clicks the real
   control rather than duplicating its behaviour. */
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-pg-trigger]');
  if (!t) return;
  const real = document.getElementById(t.dataset.pgTrigger);
  if (real && !real.disabled) real.click();
});
