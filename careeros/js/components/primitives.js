/**
 * Small shared pieces used across views: match scores, tags, reason strips,
 * evidence lists, save/connect buttons and the "Why this?" disclosure.
 */

import { html, action, cx } from '../dom.js';
import { icon } from './icons.js';
import { isSaved, isExpanded } from '../store.js';

/**
 * Match score. Deliberately renders three redundant cues — the number, a bar,
 * and a word — so the score never depends on colour alone.
 */
export function matchScore(value, label = 'match') {
  const band = value >= 85 ? 'match-strong' : value >= 75 ? 'match-mid' : 'match-low';
  const word = value >= 85 ? 'Strong' : value >= 75 ? 'Partial' : 'Weak';
  return html`
    <div class="${cx('match', band)}">
      <div class="match-value">${value}<span aria-hidden="true">%</span></div>
      <div class="match-bar" role="img" aria-label="${value} percent ${label}, ${word.toLowerCase()}">
        <span style="width:${value}%"></span>
      </div>
      <div class="match-label">${word} ${label}</div>
    </div>
  `;
}

export function tag(text, variant) {
  return html`<span class="${cx('tag', variant && `tag-${variant}`)}">${text}</span>`;
}

export function meter(value, variant) {
  return html`
    <div class="${cx('meter', variant && `meter-${variant}`)}" role="img" aria-label="${value} out of 100">
      <span style="width:${value}%"></span>
    </div>
  `;
}

/** The reason strip: every recommendation states why it is on screen. */
export function reasonStrip(text, plain = false) {
  return html`
    <p class="${cx('reason', plain && 'reason-plain')}">
      ${icon('lightbulb', 13)}
      <span>${text}</span>
    </p>
  `;
}

export function evidenceList(items, variant = 'pos') {
  if (!items || !items.length) return html``;
  return html`
    <ul class="${cx('evidence', `evidence-${variant}`)}">
      ${items.map((item) => html`<li>${item}</li>`)}
    </ul>
  `;
}

export function saveButton(kind, id, labels = {}) {
  const saved = isSaved(kind, id);
  return html`
    <button type="button" class="btn btn-sm" aria-pressed="${saved}"
      ${action('toggle-save', { kind, id })}>
      ${icon(saved ? 'bookmarkFilled' : 'bookmark', 13)}
      <span>${saved ? (labels.on || 'Saved') : (labels.off || 'Save')}</span>
    </button>
  `;
}

export function dismissButton(id, label = 'Not relevant') {
  return html`
    <button type="button" class="btn btn-sm btn-quiet" ${action('dismiss', { id })}>
      ${icon('slash', 13)}<span>${label}</span>
    </button>
  `;
}

/**
 * Expandable explanation. `id` keys the open/closed state in the store so a
 * panel stays open across re-renders.
 */
export function disclosure(id, label, bodyMarkup) {
  const open = isExpanded(id);
  const panelId = `panel-${id}`;
  return html`
    <div class="disclosure">
      <button type="button" class="disclosure-btn" aria-expanded="${open}"
        aria-controls="${panelId}" ${action('toggle-expand', { id })}>
        <span class="caret" aria-hidden="true">›</span>
        <span>${label}</span>
      </button>
      <div class="disclosure-panel" id="${panelId}" ${open ? '' : 'hidden'}>
        ${bodyMarkup}
      </div>
    </div>
  `;
}

/** Ranking factors, each with its weight named in words. */
export function factorList(factors) {
  return html`
    <div>
      ${factors.map((f) => html`
        <div class="factor">
          <span>${f.label}</span>
          <span class="factor-weight" data-weight="${f.weight}">${f.weight}</span>
        </div>
      `)}
    </div>
  `;
}

/** The signals the system refuses to use. Shown, not merely promised. */
export function notUsedList(items) {
  return html`
    <ul class="notused">
      ${items.map((item) => html`<li>${item}</li>`)}
    </ul>
  `;
}

/** Standard feedback controls attached to every explanation. */
export function explainControls(id) {
  return html`
    <div class="btn-row">
      <button type="button" class="btn btn-sm" ${action('signal-more', { id })}>More like this</button>
      <button type="button" class="btn btn-sm" ${action('signal-less', { id })}>Less like this</button>
      <button type="button" class="btn btn-sm btn-quiet" ${action('signal-never', { id })}>Never use this signal</button>
      <button type="button" class="btn btn-sm btn-quiet" ${action('report-rec', { id })}>Report bad recommendation</button>
    </div>
  `;
}

export function verified(text) {
  return html`<span class="verified-line">${icon('shield', 12)}<span>${text}</span></span>`;
}

export function caution(text) {
  return html`<p class="caution">${icon('alert', 14)}<span>${text}</span></p>`;
}

export function sectionHead(title, blurb, right) {
  return html`
    <div class="section-head">
      <div>
        <h2 class="section-title">${title}</h2>
        ${blurb ? html`<p class="small secondary">${blurb}</p>` : ''}
      </div>
      ${right || ''}
    </div>
  `;
}

export function emptyState(title, body, cta) {
  return html`
    <div class="card empty">
      <h3>${title}</h3>
      <p>${body}</p>
      ${cta ? html`<div class="btn-row" style="justify-content:center;margin-top:14px">${cta}</div>` : ''}
    </div>
  `;
}

export function avatar(initials, size = '') {
  return html`<div class="${cx('avatar', size && `avatar-${size}`)}" aria-hidden="true">${initials}</div>`;
}
