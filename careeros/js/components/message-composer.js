/**
 * Message composer.
 *
 * Context comes before the text box, because the reason to write is the hard
 * part. Drafting assistance is offered, but the draft is specific to the two
 * people involved — a generic template is worse than nothing and is flagged as
 * such.
 */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { personById } from '../data/people.js';
import { recruiters } from '../data/people.js';
import { icon } from './icons.js';
import { avatar, evidenceList } from './primitives.js';

export const tones = [
  { id: 'direct', label: 'Direct' },
  { id: 'warm', label: 'Warm' },
  { id: 'concise', label: 'Concise' },
  { id: 'peer', label: 'Peer-to-peer' },
  { id: 'recruiter', label: 'Recruiter outreach' },
  { id: 'mentorship', label: 'Mentorship request' },
];

const DRAFTS = {
  'theo-marsh': {
    peer:
      'Hi Theo, I read your post about who carries the pager for the platform. I recently led a platform '
      + 'migration involving Spark, Kubernetes and streaming workloads, and your point about operational '
      + 'ownership resonated with a problem we spent two quarters getting wrong. I would value learning '
      + 'more about the team\'s current priorities.',
    direct:
      'Hi Theo — your post on platform pager ownership matched a problem I spent two quarters on at '
      + 'Ridgeline. I led the migration of 40 pipelines onto an open table format, including the ownership '
      + 'model that came with it. You have three roles open; I am interested in the staff-level one. Would '
      + 'a short conversation about the team\'s priorities be useful?',
    warm:
      'Hi Theo, your piece on who carries the pager was the first thing I have read on the subject that '
      + 'admitted the reorganisation cost something. We went through a version of it at Ridgeline — '
      + '40 pipelines, one ownership model, several wrong turns. I would enjoy comparing notes, and I am '
      + 'also interested in what your team is building.',
    concise:
      'Hi Theo — I led a 40-pipeline platform migration at Ridgeline, including the ownership model your '
      + 'pager post describes. Interested in your staff-level opening. Open to a short conversation?',
    recruiter:
      'Hi Theo, I am a Staff Data Engineer at Ridgeline Health with Spark, Kubernetes and streaming '
      + 'platform experience, currently exploring AI infrastructure roles. Your team\'s staff opening looks '
      + 'like a strong match. Happy to share specifics on the migration work if useful.',
    mentorship:
      'Hi Theo, I am a Staff Data Engineer working toward platform leadership, and your writing on '
      + 'operational ownership has shaped how I am thinking about it. If you ever have twenty minutes, I '
      + 'would value hearing how you decided what the platform team would refuse to take on.',
  },
};

const GENERIC =
  'Hi — I would like to add you to my professional network.';

export function messageComposer() {
  if (!state.composer) return html``;
  const { personId, tone = 'peer', generic = false } = state.composer;
  const person = personById(personId) || recruiterAsPerson(personId);
  if (!person) return html``;

  const draft = generic
    ? GENERIC
    : (DRAFTS[personId] && DRAFTS[personId][tone])
      || fallbackDraft(person, tone);
  const lowContext = generic || draft.length < 140;
  const ctx = person.draftContext;

  return html`
    <div class="drawer-scrim" ${action('close-composer')}></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="composer-title">
      <div class="drawer-head">
        <div class="row grow" style="gap:11px;align-items:flex-start">
          ${avatar(person.initials, 'lg')}
          <div>
            <p class="eyebrow">Before you write</p>
            <h2 class="drawer-title" id="composer-title">${person.name}</h2>
            <p class="small secondary">${person.role}${person.company ? ` · ${person.company}` : ''}</p>
          </div>
        </div>
        <button type="button" class="icon-btn" ${action('close-composer')} aria-label="Close">
          ${icon('x', 17)}
        </button>
      </div>

      <div class="drawer-body">
        <dl class="composer-context">
          <dt>Why this person is relevant to you</dt>
          <dd>${(ctx && ctx.why) || person.reason || 'Relevant to your active intent.'}</dd>
          <dt>Shared professional context</dt>
          <dd>${(ctx && ctx.shared) || 'Overlapping technical practice and published work.'}</dd>
          <dt>What they published recently</dt>
          <dd>${(ctx && ctx.recent) || 'No recent public writing on record.'}</dd>
          <dt>An appropriate reason to make contact</dt>
          <dd>${(ctx && ctx.appropriate) || 'A specific, answerable question about their work.'}</dd>
        </dl>

        <div class="drawer-block">
          <h3>Suggested structure</h3>
          ${evidenceList([
            'One line on the specific thing of theirs you read, with the detail that proves you read it',
            'One line on the comparable thing you have done, with a number in it',
            'One question they can answer in three sentences',
            'No attachment, no résumé, no ask for "a quick call" without a subject',
          ])}
        </div>

        <div class="drawer-block">
          <h3>Tone</h3>
          <div class="tone-row" role="radiogroup" aria-label="Message tone">
            ${tones.map((t) => html`
              <button type="button" class="filter-chip" role="radio"
                aria-checked="${tone === t.id && !generic}"
                aria-pressed="${tone === t.id && !generic}"
                ${action('set-tone', { id: personId, tone: t.id })}>${t.label}</button>
            `)}
          </div>
          <label class="sr-only" for="composer-draft">Message draft</label>
          <textarea class="composer-draft" id="composer-draft" ${action('edit-draft')}>${draft}</textarea>

          <p class="${lowContext ? 'context-warning' : 'context-warning context-ok'}">
            ${icon(lowContext ? 'alert' : 'check', 15)}
            <span>
              ${lowContext
                ? 'This message does not yet explain why the conversation would be useful to both people. '
                  + 'It will be delivered, but it is the kind of request most people decline.'
                : 'This message names something specific they wrote, something specific you did, and one '
                  + 'answerable question. That is the pattern that gets replies.'}
            </span>
          </p>

          <div class="btn-row" style="margin-top:12px">
            <button type="button" class="btn btn-sm btn-quiet" ${action('use-generic', { id: personId })}>
              Show me what a low-context request looks like
            </button>
          </div>
        </div>
      </div>

      <div class="drawer-foot">
        <button type="button" class="btn btn-primary btn-sm" ${action('send-message', { id: personId })}>
          ${icon('send', 13)}<span>Send</span>
        </button>
        <button type="button" class="btn btn-sm" ${action('close-composer')}>Cancel</button>
      </div>
    </aside>
  `;
}

function recruiterAsPerson(id) {
  const r = recruiters.find((x) => x.id === id);
  if (!r) return null;
  return { id: r.id, name: r.name, initials: r.initials, role: r.role, company: '' };
}

function fallbackDraft(person, tone) {
  const first = person.name.split(' ')[0];
  if (tone === 'concise') {
    return `Hi ${first} — your work on ${(person.evidence && person.evidence[0]) || 'this problem'} overlaps `
      + 'directly with a migration I led. One question: what is the hardest part right now?';
  }
  if (tone === 'mentorship') {
    return `Hi ${first}, you have made the transition I am working toward. If you have twenty minutes, `
      + 'I would value hearing what you would do differently, particularly on the evidence you needed to show.';
  }
  return `Hi ${first}, I came across your work on ${(person.evidence && person.evidence[0]) || 'this area'} `
    + 'and it lines up closely with a platform migration I led — 40 pipelines, published cost and freshness '
    + 'numbers. I would value comparing notes on the part that surprised you.';
}
