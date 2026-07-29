/**
 * Candidate card, used under the Hiring intent.
 *
 * The emphasis is demonstrated work. "Why this candidate surfaced" is mandatory
 * and appears above the fold, and availability is only ever reported from what
 * the candidate did in public.
 */

import { html, action } from '../dom.js';
import { icon } from './icons.js';
import {
  matchScore, tag, evidenceList, saveButton, dismissButton,
  disclosure, explainControls, avatar, reasonStrip,
} from './primitives.js';

export function candidateCard(c) {
  const availabilityVariant = c.availability === 'Not marked open' ? '' : 'primary';
  return html`
    <article class="card person" aria-labelledby="cand-${c.id}">
      <div class="person-top">
        ${avatar(c.initials, 'lg')}
        <div class="person-id">
          <h3 class="person-name" id="cand-${c.id}">${c.name}</h3>
          <p class="person-role">${c.role} · ${c.company}</p>
          <p class="person-loc">${c.availabilityBasis}</p>
        </div>
        ${matchScore(c.match, 'evidence match')}
      </div>

      <div class="row wrap" style="margin-top:11px;gap:5px">
        ${tag(c.availability, availabilityVariant)}
      </div>

      <div style="margin-top:12px">
        <p class="eyebrow" style="margin-bottom:6px">Why this candidate surfaced</p>
        <p class="person-reason" style="margin-top:0">${c.surfaced}</p>
      </div>

      <div style="margin-top:13px">
        <p class="eyebrow" style="margin-bottom:6px">Demonstrated strengths</p>
        <ul class="evidence evidence-pos">
          ${c.strengths.map((s) => html`<li><b>${s.label}:</b> ${s.detail}</li>`)}
        </ul>
      </div>

      ${c.gaps && c.gaps.length ? html`
        <div style="margin-top:12px">
          <p class="eyebrow" style="margin-bottom:6px">Worth probing</p>
          ${evidenceList(c.gaps, 'gap')}
        </div>
      ` : ''}

      ${c.referral ? html`
        <div class="intro-path">
          ${icon('link', 13)}
          <span style="margin-left:4px">
            Referral path: <b>${c.referral.via}</b> — ${c.referral.note}
          </span>
        </div>
      ` : ''}

      <div class="person-actions">
        <button type="button" class="btn btn-primary btn-sm" ${action('open-composer', { id: c.id })}>
          ${icon('send', 13)}<span>Write with context</span>
        </button>
        ${saveButton('people', c.id, { off: 'Shortlist', on: 'Shortlisted' })}
        ${c.referral ? html`
          <button type="button" class="btn btn-sm btn-quiet" ${action('request-intro', { id: c.id })}>
            Request the referral
          </button>
        ` : ''}
        ${dismissButton(c.id, 'Not a fit')}
      </div>

      ${disclosure(`whycand-${c.id}`, 'Why this candidate?', html`
        <h4>Inputs used</h4>
        ${evidenceList([
          `Demonstrated stack overlap with the role requirements: ${c.match}%`,
          'Published work, with the claims checked against what is verifiable',
          'Peer validation from engineers who worked on the same systems',
          c.referral ? 'An internal referral path exists' : 'No internal referral path — this did not change the ranking',
        ])}
        <h4 style="margin-top:14px">Not used</h4>
        ${html`
          <ul class="notused">
            <li>Résumé keyword frequency</li>
            <li>University or employer prestige</li>
            <li>Ethnicity</li><li>Gender</li><li>Age</li>
            <li>Photo</li>
            <li>Private browsing or application history</li>
            <li>Gaps in employment</li>
          </ul>
        `}
        <h4 style="margin-top:14px">A caution</h4>
        <p class="small secondary">
          A high evidence match means this person has publicly demonstrated the work. It says nothing about
          whether they want your role, and nothing about how they will be treated in your process.
        </p>
        <h4 style="margin-top:14px">Your controls</h4>
        ${explainControls(c.id)}
      `)}
    </article>
  `;
}

/** Compact rail variant, used on the hiring dashboard. */
export function candidateRailCard(c) {
  return html`
    <article class="card-pad" style="border-bottom:1px solid var(--border)">
      <div class="row" style="align-items:flex-start;gap:10px">
        ${avatar(c.initials)}
        <div class="grow">
          <p style="font-size:13.5px;font-weight:600;line-height:1.3">${c.name}</p>
          <p class="tiny muted">${c.role} · ${c.company}</p>
        </div>
        <div class="mono" style="font-size:13px;font-weight:700;color:var(--primary)">${c.match}%</div>
      </div>
      ${reasonStrip(c.surfaced)}
      <div class="btn-row" style="margin-top:9px">
        <button type="button" class="btn btn-sm" ${action('navigate', { route: 'network' })}>Open</button>
        ${saveButton('people', c.id, { off: 'Shortlist', on: 'Shortlisted' })}
      </div>
    </article>
  `;
}
