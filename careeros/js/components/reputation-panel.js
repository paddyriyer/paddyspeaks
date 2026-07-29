/**
 * Professional reputation. A score with no visible derivation is a rumour, so
 * every dimension opens to show the work it was computed from — and the whole
 * panel can be switched off.
 */

import { html, action } from '../dom.js';
import { state, isExpanded } from '../store.js';
import { reputation } from '../data/user.js';
import { meter, evidenceList } from './primitives.js';
import { icon } from './icons.js';

export function reputationPanel({ compact = true } = {}) {
  if (state.reputationHidden) {
    return html`
      <section class="card card-pad" aria-label="Professional reputation, hidden">
        <div class="row-between">
          <p class="small secondary">Reputation panel hidden.</p>
          <button type="button" class="btn btn-sm" ${action('toggle-reputation')}>
            ${icon('eye', 13)}<span>Show</span>
          </button>
        </div>
      </section>
    `;
  }

  const dims = compact ? reputation.dimensions.slice(0, 6) : reputation.dimensions;

  return html`
    <section class="card" aria-labelledby="rep-head">
      <div class="card-head">
        <h3 id="rep-head">Professional reputation</h3>
        <button type="button" class="btn btn-sm btn-quiet" ${action('toggle-reputation')}
          aria-label="Hide the reputation panel">${icon('eyeOff', 13)}<span>Hide</span></button>
      </div>
      <div class="card-body">
        <div class="rep-total">
          <span class="rep-score">${reputation.total}</span>
          <span class="rep-outof">/ ${reputation.outOf}</span>
        </div>
        <p class="rep-basis">${reputation.basis}</p>

        <div style="margin-top:14px">
          ${dims.map((dim) => dimensionRow(dim))}
        </div>

        ${compact ? html`
          <button type="button" class="btn btn-sm btn-block" style="margin-top:12px"
            ${action('navigate', { route: 'career-agent' })}>See all eight dimensions</button>
        ` : ''}
      </div>
      <div class="card-foot">
        Reputation is a description of your record, not a verdict on you. It is visible only to you
        unless you choose to show it, it can be hidden entirely, and low-sample dimensions are
        labelled provisional rather than scored confidently.
      </div>
    </section>
  `;
}

function dimensionRow(dim) {
  const open = isExpanded(`rep-${dim.id}`);
  const variant = dim.score >= 80 ? '' : dim.score >= 65 ? 'accent' : 'warning';
  return html`
    <div>
      <button type="button" class="dim" aria-expanded="${open}"
        aria-controls="rep-panel-${dim.id}" ${action('toggle-expand', { id: `rep-${dim.id}` })}>
        <span class="dim-top">
          <span class="dim-label">${dim.label}</span>
          <span class="dim-value">${dim.score}</span>
        </span>
        <span class="dim-meter">${meter(dim.score, variant)}</span>
        <span class="dim-trend">${dim.trend} · ${open ? 'hide' : 'how this is calculated'}</span>
      </button>
      <div class="dim-inputs" id="rep-panel-${dim.id}" ${open ? '' : 'hidden'}>
        <p class="eyebrow" style="margin-bottom:7px">What this is computed from</p>
        ${evidenceList(dim.inputs)}
      </div>
    </div>
  `;
}
