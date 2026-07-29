/**
 * A Knowledge Feed post.
 *
 * Reactions describe what the reader got out of it. Metrics describe
 * usefulness, not reach. Both the reason it surfaced and the quality
 * attributes the ranker rewarded are on the card, not buried in a settings page.
 */

import { html, action } from '../dom.js';
import { isSaved } from '../store.js';
import { reactions, qualityFilters } from '../data/posts.js';
import { icon } from './icons.js';
import {
  reasonStrip, tag, saveButton, disclosure, evidenceList,
  explainControls, avatar,
} from './primitives.js';

const qualityLabel = (id) => (qualityFilters.find((q) => q.id === id) || {}).label || id;

export function feedPost(post) {
  return html`
    <article class="card post" aria-labelledby="post-${post.id}">
      <div class="post-author">
        ${avatar(post.initials)}
        <div class="grow">
          <p class="post-author-name">${post.author}</p>
          <p class="post-author-meta">${post.role} · ${post.company} · ${post.posted} · ${post.readTime} read</p>
        </div>
        ${tag(post.topic)}
      </div>

      ${reasonStrip(post.reason)}

      <h3 class="post-title" id="post-${post.id}">${post.title}</h3>
      <p class="post-summary">${post.summary}</p>

      ${post.excerpt ? html`<p class="post-excerpt">${post.excerpt}</p>` : ''}

      ${post.disagreement ? html`
        <p class="reason reason-plain" style="margin-top:11px">
          ${icon('info', 13)}<span>${post.disagreement}</span>
        </p>
      ` : ''}

      <div class="post-quality">
        ${post.quality.map((q) => tag(qualityLabel(q), 'primary'))}
      </div>

      <div class="post-metrics">
        <span><b>${post.metrics.helpful}</b> found this helpful</span>
        <span><b>${post.metrics.comments}</b> thoughtful comments</span>
        <span><b>${post.metrics.saved}</b> professionals saved this</span>
        <span><b>${post.metrics.hiringViews}</b> hiring managers read the discussion</span>
      </div>

      <div class="post-reactions">
        ${reactions.map((r) => html`
          <button type="button" class="btn btn-sm" ${action('react', { post: post.id, reaction: r.id })}>
            ${r.label}
          </button>
        `)}
        <button type="button" class="btn btn-sm" ${action('discuss', { post: post.id })}>
          ${icon('message', 13)}<span>Discuss</span>
        </button>
        ${saveButton('posts', post.id)}
        <button type="button" class="btn btn-sm btn-quiet" ${action('reduce-topic', { topic: post.topic })}>
          ${icon('slash', 13)}<span>Reduce content like this</span>
        </button>
      </div>

      ${disclosure(`whypost-${post.id}`, 'Why this post?', html`
        <h4>Why it surfaced</h4>
        ${evidenceList(post.reasonDetail)}

        <h4 style="margin-top:14px">What the ranker rewarded</h4>
        <p class="small secondary">${post.qualityNote}</p>

        <h4 style="margin-top:14px">What was not used</h4>
        <p class="small secondary">
          Not used: how many people follow the author, whether the post is trending,
          time spent on the platform, or how recently you last opened the app.
        </p>

        <h4 style="margin-top:14px">Your controls</h4>
        ${explainControls(post.id)}
      `)}
    </article>
  `;
}

/** One-line variant used in the "saved" tab summary and rails. */
export function postRailRow(post) {
  return html`
    <button type="button" class="signal" ${action('navigate', { route: 'knowledge' })}>
      <span class="signal-top">${tag(post.topic)}<span class="tiny muted">${post.readTime}</span></span>
      <span class="signal-title" style="display:block">${post.title}</span>
      <span class="signal-detail" style="display:block">${post.author} · ${isSaved('posts', post.id) ? 'Saved' : post.reason}</span>
    </button>
  `;
}
