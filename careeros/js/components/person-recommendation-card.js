/**
 * A person recommendation.
 *
 * The card is built around one claim: here is why this specific human is worth
 * your professional time. Match percentage never leads with mutual connections,
 * and the "Why this person?" panel names both the inputs used and the ones
 * deliberately excluded.
 */

import { html, action } from '../dom.js';
import { isConnected } from '../store.js';
import { notUsed } from '../data/people.js';
import { icon } from './icons.js';
import {
  matchScore, tag, evidenceList, saveButton, dismissButton,
  disclosure, factorList, notUsedList, explainControls, avatar,
} from './primitives.js';

export function personRecommendationCard(person) {
  const connected = isConnected(person.id);
  return html`
    <article class="card person" aria-labelledby="person-${person.id}">
      <div class="person-top">
        ${avatar(person.initials, 'lg')}
        <div class="person-id">
          <h3 class="person-name" id="person-${person.id}">${person.name}</h3>
          <p class="person-role">${person.role} · ${person.company}</p>
          <p class="person-loc">${person.location}</p>
        </div>
        ${matchScore(person.match)}
      </div>

      <div class="row wrap" style="margin-top:11px;gap:5px">
        ${tag(person.tag, person.tag === 'Hiring now' || person.tag === 'Hiring manager' ? 'accent' : 'primary')}
        ${tag(`Confidence: ${person.confidence}`)}
      </div>

      <p class="person-reason">${person.reason}</p>

      <div style="margin-top:11px">
        <p class="eyebrow" style="margin-bottom:6px">Evidence</p>
        ${evidenceList(person.evidence)}
      </div>

      ${person.intro ? html`
        <div class="intro-path">
          ${icon('link', 13)}
          <span style="margin-left:4px">
            Introduction path: <b>${person.intro.via}</b>, ${person.intro.viaRole}.
            ${person.intro.note}
          </span>
        </div>
      ` : ''}

      <div class="person-actions">
        <button type="button" class="${connected ? 'btn btn-sm' : 'btn btn-primary btn-sm'}"
          aria-pressed="${connected}" ${action('toggle-connect', { id: person.id })}>
          ${icon(connected ? 'check' : 'plus', 13)}
          <span>${connected ? 'Request sent' : 'Connect'}</span>
        </button>
        <button type="button" class="btn btn-sm" ${action('open-composer', { id: person.id })}>
          ${icon('send', 13)}<span>Draft a message</span>
        </button>
        ${saveButton('people', person.id)}
        ${person.intro ? html`
          <button type="button" class="btn btn-sm btn-quiet" ${action('request-intro', { id: person.id })}>
            Ask ${person.intro.via.split(' ')[0]} for an introduction
          </button>
        ` : ''}
        ${dismissButton(person.id, 'Not relevant')}
      </div>

      ${disclosure(`why-${person.id}`, 'Why this person?', html`
        <h4>Inputs used, and how much each counted</h4>
        ${factorList(person.factors)}

        <h4 style="margin-top:14px">Confidence</h4>
        <p class="small secondary">
          ${person.confidence}.
          ${person.confidence === 'High'
            ? 'Multiple independent signals agree, and at least one is verifiable by you.'
            : 'Fewer corroborating signals than usual. Treat the percentage as approximate.'}
        </p>

        <h4 style="margin-top:14px">Not used, and never will be</h4>
        ${notUsedList(notUsed)}

        <h4 style="margin-top:14px">Your controls</h4>
        ${explainControls(person.id)}
      `)}
    </article>
  `;
}

/** Compact variant for the right rail. */
export function personRailCard(person) {
  return html`
    <article class="card-pad" style="border-bottom:1px solid var(--border)">
      <div class="row" style="align-items:flex-start;gap:10px">
        ${avatar(person.initials)}
        <div class="grow">
          <p style="font-size:13.5px;font-weight:600;line-height:1.3">${person.name}</p>
          <p class="tiny muted">${person.role} · ${person.company}</p>
        </div>
        <div class="mono" style="font-size:13px;font-weight:700;color:var(--primary)">${person.match}%</div>
      </div>
      <p class="tiny secondary" style="margin-top:8px;line-height:1.5">${person.reason}</p>
      <div class="btn-row" style="margin-top:9px">
        <button type="button" class="btn btn-sm" ${action('navigate', { route: 'network' })}>Why this person?</button>
        ${saveButton('people', person.id)}
      </div>
    </article>
  `;
}
