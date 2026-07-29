/**
 * Recruiter transparency.
 *
 * The intent is calibration, not punishment: a candidate should know whether to
 * expect a reply. Every figure carries a confidence range, low-sample metrics
 * are withheld rather than guessed, and weak records are framed as context
 * about a process rather than a verdict on a person.
 */

import { html, action } from '../dom.js';
import { recruiterNote } from '../data/people.js';
import { icon } from './icons.js';
import { avatar } from './primitives.js';

export function recruiterTrustCard(recruiter) {
  return html`
    <article class="card" aria-labelledby="rec-${recruiter.id}">
      <div class="card-head">
        <div class="row" style="gap:11px">
          ${avatar(recruiter.initials)}
          <div>
            <h3 id="rec-${recruiter.id}" style="font-family:var(--serif);font-size:16px">${recruiter.name}</h3>
            <p class="tiny muted">${recruiter.role}</p>
          </div>
        </div>
      </div>
      <div class="card-body">
        <p class="tiny muted" style="margin-bottom:14px">${recruiter.sample}</p>
        <dl class="trust-grid">
          ${recruiter.metrics.map((m) => html`
            <div class="trust-metric">
              <dt>${m.label}</dt>
              <dd>
                <div class="trust-value">
                  <span>${m.value}</span>
                  <span class="band band-${m.band}">${bandWord(m.band)}</span>
                </div>
                <div class="trust-range">${m.range}</div>
              </dd>
            </div>
          `)}
        </dl>
        ${recruiter.note ? html`
          <p class="caution" style="margin-top:15px">${icon('info', 14)}<span>${recruiter.note}</span></p>
        ` : ''}
        <div class="btn-row" style="margin-top:15px">
          <button type="button" class="btn btn-sm" ${action('open-composer', { id: recruiter.id })}>
            ${icon('send', 13)}<span>Draft a message</span>
          </button>
          <button type="button" class="btn btn-sm btn-quiet" ${action('methodology')}>How these are measured</button>
        </div>
      </div>
      <div class="card-foot">${recruiterNote}</div>
    </article>
  `;
}

function bandWord(band) {
  if (band === 'strong') return 'Strong';
  if (band === 'medium') return 'Mixed';
  if (band === 'weak') return 'Below par';
  return 'No data';
}
