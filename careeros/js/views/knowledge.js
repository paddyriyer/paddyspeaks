/** Knowledge view: the full feed, the published noise filter, and the controls. */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { intentById } from '../data/user.js';
import { knowledgeFeed, feedPriorityControl, noiseFilterPanel, rankedPosts } from '../components/knowledge-feed.js';
import { signalNotifications } from '../components/signal-notifications.js';
import { icon } from '../components/icons.js';

export function knowledgeView() {
  const intent = intentById(state.intent);
  const count = rankedPosts().length;
  return html`
    <div class="layout-2col">
      <div class="center-stack">
        <header>
          <p class="eyebrow">Knowledge · ${intent.label}</p>
          <h1 class="display" style="margin-top:8px">Knowledge feed</h1>
          <p class="lede">
            ${count} items qualified out of 240 candidates. The rest were not hidden from you by accident —
            they were down-ranked for reasons you can read below.
          </p>
        </header>

        <p class="reason">
          ${icon('info', 13)}
          <span>
            This feed has no infinite scroll and no "you're all caught up" reward. It ends when the
            useful material ends, which today is ${count} items.
          </span>
        </p>

        ${knowledgeFeed({ heading: false })}

        ${noiseFilterPanel()}
      </div>

      <div class="rail">
        <div class="rail-stack">
          ${feedPriorityControl()}
          ${signalNotifications({ limit: 3 })}
          ${contributionCard()}
        </div>
      </div>
    </div>
  `;
}

function contributionCard() {
  return html`
    <section class="card" aria-labelledby="contrib-head">
      <div class="card-head"><h3 id="contrib-head">Your own writing</h3></div>
      <div class="card-body">
        <p class="small secondary">
          Your last piece was read by 7 hiring managers in your target companies and cited by 2
          practitioners. Your profile summary, over the same period, was read by 1.
        </p>
        <p class="small secondary" style="margin-top:10px">
          Writing is the highest-leverage reputation signal available to you, and it is the one you
          are currently best at.
        </p>
        <div class="btn-row" style="margin-top:12px">
          <button type="button" class="btn btn-primary btn-sm btn-block" ${action('start-draft')}>
            Start a draft from your Kubernetes work
          </button>
        </div>
      </div>
      <div class="card-foot">
        There is no posting streak here, and no prompt to post because you have been quiet.
      </div>
    </section>
  `;
}
