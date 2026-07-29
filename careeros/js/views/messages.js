/**
 * Messages view.
 *
 * Organised around reasons to write rather than an inbox of arrivals. Each
 * conversation opportunity carries the shared context that makes it legitimate.
 */

import { html, action } from '../dom.js';
import { people } from '../data/people.js';
import { icon } from '../components/icons.js';
import { avatar, sectionHead, evidenceList, tag } from '../components/primitives.js';

const threads = [
  {
    id: 'th-theo',
    personId: 'theo-marsh',
    subject: 'Re: Who carries the pager for the platform?',
    last: 'Theo replied to your comment and agreed with the pager argument.',
    when: '4 days ago',
    state: 'Open exchange',
    context: [
      'You commented on his post; he replied and agreed',
      'He has three open roles you match at 88%',
      'You have both written about operational ownership this month',
    ],
    suggestion: 'Continue the thread on its own terms. Mentioning the roles can wait one message.',
  },
  {
    id: 'th-priya',
    personId: 'priya-ramaswami',
    subject: 'Partition granularity — we disagree',
    last: 'Not started. Her migration post contradicts your June conclusion.',
    when: 'Opportunity',
    state: 'Not started',
    context: [
      'You published on the same topic in the same month',
      'She reaches a different conclusion on partition granularity',
      'She is speaking at DataEng Summit, where you could continue it in person',
    ],
    suggestion: 'Disagreement, stated respectfully and with your numbers, is the strongest possible opening.',
  },
  {
    id: 'th-renata',
    personId: 'renata-okafor',
    subject: 'Two roles matching your saved search',
    last: 'Renata sent role details, including the band, without being asked.',
    when: '2 days ago',
    state: 'Awaiting your reply',
    context: [
      'She has filled 5 comparable roles in 90 days',
      '96% candidate response rate — she replies',
      'Both roles are California, remote or hybrid',
    ],
    suggestion: 'She led with the band and the scope. Answer with the same directness.',
  },
];

export function messagesView() {
  return html`
    <div class="layout-2col">
      <div class="center-stack">
        <header>
          <p class="eyebrow">Messages</p>
          <h1 class="display" style="margin-top:8px">Conversations with a reason</h1>
          <p class="lede">
            Three threads where you have something specific to say. An inbox sorted by arrival time
            rewards whoever wrote last; this is sorted by whether a reply would be useful to both people.
          </p>
        </header>

        <section>
          ${sectionHead('Open and available', 'Context is assembled before you write, because that is the part people skip.')}
          <div class="stack-md">
            ${threads.map((t) => threadCard(t))}
          </div>
        </section>

        <section class="card" aria-labelledby="msg-standard">
          <div class="card-head"><h3 id="msg-standard">The standard for a first message</h3></div>
          <div class="card-body">
            <p class="small secondary" style="margin-bottom:12px">
              Connection requests with no stated reason are the most common interaction on professional
              networks and the least useful. The composer will send one if you insist, but it will tell
              you what it is first.
            </p>
            ${evidenceList([
              'Name the specific thing of theirs you read, with a detail that proves you read it',
              'Name the comparable thing you have done, with a number in it',
              'Ask one question they can answer in three sentences',
              'Make it easy to decline',
            ], 'pos')}
            <p class="eyebrow" style="margin:14px 0 7px">What gets flagged</p>
            ${evidenceList([
              '"I would like to add you to my professional network."',
              '"Quick call?" with no subject',
              'A résumé attached to a first message',
              'The same message sent to eleven people this week',
            ], 'gap')}
          </div>
        </section>
      </div>

      <div class="rail">
        <div class="rail-stack">
          ${draftCard()}
        </div>
      </div>
    </div>
  `;
}

function threadCard(thread) {
  const person = people.find((p) => p.id === thread.personId);
  return html`
    <article class="card card-pad">
      <div class="row" style="align-items:flex-start;gap:11px">
        ${avatar(person.initials, 'lg')}
        <div class="grow">
          <div class="row-between wrap">
            <p style="font-size:14px;font-weight:600">${person.name}</p>
            ${tag(thread.state, thread.state === 'Awaiting your reply' ? 'accent' : 'primary')}
          </div>
          <p class="tiny muted">${person.role} · ${person.company} · ${thread.when}</p>
          <p style="font-family:var(--serif);font-size:15.5px;font-weight:600;margin-top:9px">${thread.subject}</p>
          <p class="small secondary" style="margin-top:4px">${thread.last}</p>
        </div>
      </div>

      <div style="margin-top:13px">
        <p class="eyebrow" style="margin-bottom:6px">Shared professional context</p>
        ${evidenceList(thread.context)}
      </div>

      <p class="reason" style="margin-top:12px">${icon('lightbulb', 13)}<span>${thread.suggestion}</span></p>

      <div class="btn-row" style="margin-top:13px">
        <button type="button" class="btn btn-primary btn-sm" ${action('open-composer', { id: person.id })}>
          ${icon('send', 13)}<span>Open the composer</span>
        </button>
        <button type="button" class="btn btn-sm" ${action('open-drawer', { kind: 'person', id: person.id })}>
          Why this person?
        </button>
      </div>
    </article>
  `;
}

function draftCard() {
  return html`
    <section class="card" aria-labelledby="draft-head">
      <div class="card-head"><h3 id="draft-head">Drafting assistance</h3></div>
      <div class="card-body">
        <p class="small secondary">
          The composer will write a first draft, but it works from what you have actually done and what
          they have actually published. It will not generate a message it cannot ground in both.
        </p>
        <p class="small secondary" style="margin-top:10px">
          Six tones are available. None of them is "enthusiastic".
        </p>
        <button type="button" class="btn btn-sm btn-block" style="margin-top:12px"
          ${action('open-composer', { id: 'theo-marsh' })}>Try it with Theo Marsh</button>
      </div>
      <div class="card-foot">
        Sending is never automated, and there is no bulk send. A message worth receiving takes a minute
        of your attention.
      </div>
    </section>
  `;
}
