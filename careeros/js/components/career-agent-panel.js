/**
 * The Career Agent.
 *
 * Every insight is a chain: what happened → why it matters → the evidence →
 * one recommended action → the expected benefit and the effort it costs. No
 * insight may be phrased as "improve your profile".
 */

import { html, action } from '../dom.js';
import { isExpanded } from '../store.js';
import { insights } from '../data/signals.js';
import { icon } from './icons.js';
import { evidenceList, tag } from './primitives.js';

export function careerAgentPanel({ limit = 3, showHeader = true } = {}) {
  const shown = insights.slice(0, limit);
  return html`
    <section class="card agent-card" aria-labelledby="agent-head">
      ${showHeader ? html`
        <div class="agent-head">
          <span class="agent-mark">${icon('compass', 14)}</span>
          <div class="grow">
            <h2 id="agent-head" class="section-title" style="font-size:16px">Your Career Agent</h2>
            <p class="tiny muted">Five findings from your last 90 days of professional activity</p>
          </div>
          <button type="button" class="btn btn-sm" ${action('navigate', { route: 'career-agent' })}>
            Open agent
          </button>
        </div>
      ` : ''}
      <div class="divide">
        ${shown.map((insight) => insightBlock(insight))}
      </div>
      ${limit < insights.length ? html`
        <div class="card-foot">
          <button type="button" class="disclosure-btn" ${action('navigate', { route: 'career-agent' })}>
            <span aria-hidden="true">›</span>
            <span>${insights.length - limit} more findings, including the long-arc one about leadership</span>
          </button>
        </div>
      ` : ''}
    </section>
  `;
}

export function insightBlock(insight) {
  const open = isExpanded(`ins-open-${insight.id}`);
  const priorityVariant = insight.priority === 'Quick win' ? 'primary'
    : insight.priority === 'Longer arc' ? '' : 'accent';

  return html`
    <article class="insight">
      <div class="insight-top">
        ${tag(insight.priority, priorityVariant)}
      </div>
      <p class="insight-happened">${insight.happened}</p>
      <p class="insight-matters">${insight.matters}</p>

      <div class="insight-actions">
        <button type="button" class="btn btn-primary btn-sm"
          ${action('navigate', { route: insight.action.route, anchor: insight.action.anchor })}>
          ${insight.action.label}
        </button>
        <button type="button" class="disclosure-btn" style="margin-left:4px"
          aria-expanded="${open}" aria-controls="ins-panel-${insight.id}"
          ${action('toggle-expand', { id: `ins-open-${insight.id}` })}>
          <span class="caret" aria-hidden="true">›</span>
          <span>Show the evidence</span>
        </button>
      </div>

      <div class="disclosure-panel" id="ins-panel-${insight.id}" ${open ? '' : 'hidden'}>
        <h4>Evidence</h4>
        ${evidenceList(insight.evidence)}
      </div>

      <dl class="insight-meta">
        <div>
          <dt>Expected benefit</dt>
          <dd>${insight.benefit}</dd>
        </div>
        <div>
          <dt>Effort</dt>
          <dd>${insight.effort}</dd>
        </div>
      </dl>
    </article>
  `;
}
