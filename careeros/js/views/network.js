/**
 * Network view. The full "People Who Can Help You Grow" surface, plus events
 * and communities — the places where a professional relationship actually forms.
 */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { intentById, communities } from '../data/user.js';
import { events } from '../data/signals.js';
import { people, matchBasis, notUsed } from '../data/people.js';
import { icon } from '../components/icons.js';
import { networkingPanel } from '../components/networking-panel.js';
import { eventRecommendation } from '../components/event-recommendation.js';
import { signalNotifications } from '../components/signal-notifications.js';
import { sectionHead, notUsedList, evidenceList, tag, saveButton } from '../components/primitives.js';

export function networkView() {
  const intent = intentById(state.intent);
  return html`
    <div class="layout-2col">
      <div class="center-stack">
        <header>
          <p class="eyebrow">Network · ${intent.label}</p>
          <h1 class="display" style="margin-top:8px">
            ${state.intent === 'hiring' ? 'Candidates and referral paths' : 'People who can help you grow'}
          </h1>
          <p class="lede">
            ${state.intent === 'hiring'
              ? 'Ranked on work someone else can read. Every card states why it surfaced and what was not used.'
              : 'Not everyone you might know. The people whose current professional activity intersects what you are trying to do.'}
          </p>
        </header>

        ${networkingPanel({ intentId: state.intent, heading: false })}

        <section aria-labelledby="net-events">
          ${sectionHead(
            'Worth your time',
            'Three of forty-seven events in your area qualified. The other forty-four were larger.',
          )}
          <div class="stack-md">
            ${events.map((e) => eventRecommendation(e))}
          </div>
        </section>

        <section aria-labelledby="net-comm">
          ${sectionHead(
            'Communities built around practice',
            'Membership costs something — a contribution, a verified role history, or a paper read in advance. That is what keeps them useful.',
          )}
          <div class="stack-md">
            ${communities.map((c) => communityCard(c))}
          </div>
        </section>
      </div>

      <div class="rail">
        <div class="rail-stack">
          ${matchExplainer()}
          ${signalNotifications({ limit: 4 })}
          ${introPathsCard()}
        </div>
      </div>
    </div>
  `;
}

function communityCard(c) {
  const member = c.yourRole.startsWith('Member');
  return html`
    <article class="card card-pad">
      <div class="row-between wrap" style="align-items:flex-start">
        <div class="grow">
          <h3 style="font-family:var(--serif);font-size:16px;font-weight:600">${c.name}</h3>
          <p class="tiny muted" style="margin-top:3px">${c.members}</p>
        </div>
        ${tag(member ? 'Member' : 'Not a member', member ? 'primary' : '')}
      </div>
      <p class="small secondary" style="margin-top:10px">${c.basis}</p>
      <p class="tiny mono muted" style="margin-top:8px">${c.yourRole}</p>
      ${c.suggestion ? html`
        <p class="reason" style="margin-top:11px">${icon('lightbulb', 13)}<span>${c.suggestion}</span></p>
      ` : ''}
      <div class="btn-row" style="margin-top:12px">
        <button type="button" class="btn btn-sm ${member ? '' : 'btn-primary'}"
          ${action('community-action', { id: c.id })}>
          ${member ? 'Open community' : 'Request membership'}
        </button>
        ${saveButton('events', c.id)}
      </div>
    </article>
  `;
}

function matchExplainer() {
  return html`
    <section class="card" aria-labelledby="match-exp">
      <div class="card-head"><h3 id="match-exp">How matching works</h3></div>
      <div class="card-body">
        <p class="small secondary">${matchBasis}</p>
        <p class="eyebrow" style="margin:14px 0 7px">Factors that count</p>
        ${evidenceList([
          'Hiring activity, and whether it is for your titles',
          'Demonstrated skill and stack overlap',
          'Shared professional interests and published work',
          'Mentorship history with confirmed outcomes',
          'Community involvement and events attended',
          'Career-transition relevance',
          'Location, against your stated preference',
          'Open-source work',
        ])}
        <p class="eyebrow" style="margin:14px 0 7px">Never used</p>
        ${notUsedList(notUsed)}
      </div>
      <div class="card-foot">
        Mutual connections are one weak factor, and never the reason a person is at the top of your list.
      </div>
    </section>
  `;
}

function introPathsCard() {
  const withIntro = people.filter((p) => p.intro);
  return html`
    <section class="card" aria-labelledby="intro-head">
      <div class="card-head">
        <h3 id="intro-head">Introduction paths available</h3>
        <span class="tiny muted">${withIntro.length}</span>
      </div>
      <div class="divide">
        ${withIntro.map((p) => html`
          <div class="card-pad">
            <p class="small" style="font-weight:600">${p.name}</p>
            <p class="tiny muted" style="margin-top:2px">${p.role} · ${p.company}</p>
            <p class="tiny secondary" style="margin-top:7px">
              Through <b>${p.intro.via}</b> — ${p.intro.note}
            </p>
            <button type="button" class="btn btn-sm" style="margin-top:9px"
              ${action('request-intro', { id: p.id })}>Ask for an introduction</button>
          </div>
        `)}
      </div>
      <div class="card-foot">
        An introduction is a favour with a cost to the person making it. The suggested request explains
        what you want and gives them an easy way to decline.
      </div>
    </section>
  `;
}
