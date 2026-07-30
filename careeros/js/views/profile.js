/**
 * Profile 2.0.
 *
 * A résumé lists positions. This lists what happened, what can be verified, and
 * where the evidence is thin — because the thin parts are what a hiring manager
 * finds anyway.
 *
 * The profile belongs to whoever is signed in. Under Mentoring that is Nadia
 * Rhee and under Hiring it is Amara Osei, so a section this person genuinely has
 * nothing in is left out rather than filled with somebody else's record.
 */

import { html, action } from '../dom.js';
import { state } from '../store.js';
import { intentById } from '../data/user.js';
import { personaFor } from '../data/personas.js';
import { profileFor } from '../data/profiles.js';
import { icon } from '../components/icons.js';
import { skillEvidencePanel } from '../components/skill-evidence-panel.js';
import { reputationPanel } from '../components/reputation-panel.js';
import { sectionHead, evidenceList, tag } from '../components/primitives.js';

export function profileView() {
  const intent = intentById(state.intent);
  const persona = personaFor(state.intent, state.hiringView);
  const profile = profileFor(persona.id);

  return html`
    <div class="layout-2col">
      <div class="center-stack">
        ${hero(intent, persona, profile)}
        ${evidenceSection(profile)}
        ${skillEvidencePanel()}
        ${currentFocus(profile)}
        ${timelineSection(profile)}
        ${writingSection(profile)}
        ${mentorshipSection(profile)}
        ${communitiesSection(profile)}
      </div>

      <div class="rail">
        <div class="rail-stack">
          ${reputationPanel({ compact: true })}
          ${availabilityCard(intent, profile)}
          ${visitorCard(profile)}
        </div>
      </div>
    </div>
  `;
}

function hero(intent, persona, profile) {
  const g = profile.goal;
  return html`
    <section class="card profile-hero">
      <div class="profile-hero-top">
        <div class="profile-avatar" aria-hidden="true">${persona.initials}</div>
        <div class="grow">
          <h1 style="font-family:var(--serif);font-size:26px;font-weight:600;letter-spacing:-0.02em">${persona.name}</h1>
          <p class="lede" style="margin-top:3px">${persona.title} · ${persona.org}</p>
          <p class="small muted" style="margin-top:2px">${persona.location}</p>
          <div class="row wrap" style="gap:5px;margin-top:11px">
            ${tag(`Open to: ${intent.label.toLowerCase()}`, 'primary')}
            ${g ? tag(g.workModel) : ''}
            ${g ? tag(g.level) : ''}
          </div>
        </div>
      </div>

      <div>
        <p class="eyebrow" style="margin-top:20px">Professional thesis</p>
        <p class="thesis">${profile.thesis}</p>
      </div>

      <div class="btn-row" style="margin-top:18px">
        <button type="button" class="btn btn-primary btn-sm" ${action('navigate', { route: 'career-agent' })}>
          ${icon('compass', 13)}<span>Ask the agent what to strengthen</span>
        </button>
        <button type="button" class="btn btn-sm" ${action('edit-profile')}>Edit profile</button>
      </div>
    </section>
  `;
}

function evidenceSection(profile) {
  const list = profile.evidenceOfWork;
  return html`
    <section aria-labelledby="ev-head">
      ${sectionHead(
        'Evidence of work',
        `${count(list.length)} claims, each with the detail that lets someone check it. `
        + 'A claim nobody can check is a sentence, not a credential.',
      )}
      <div class="evidence-grid">
        ${list.map((e) => html`
          <article class="evidence-card">
            <p class="evidence-claim">${e.claim}</p>
            <p class="evidence-detail">${e.detail}</p>
            <p class="evidence-verified">${icon('shield', 11)}<span>${e.verified}</span></p>
          </article>
        `)}
      </div>
    </section>
  `;
}

function currentFocus(profile) {
  return html`
    <section class="card" aria-labelledby="focus-head">
      <div class="card-head">
        <h2 id="focus-head" class="section-title" style="font-size:16px">Current focus</h2>
        <span class="tiny muted">Updated this month</span>
      </div>
      <div class="card-body">
        ${evidenceList(profile.currentFocus, 'pos')}
      </div>
      <div class="card-foot">
        Current focus is what makes a profile worth reading twice. It is the field most people leave
        untouched for years.
      </div>
    </section>
  `;
}

function timelineSection(profile) {
  return html`
    <section class="card" aria-labelledby="tl-head">
      <div class="card-head">
        <h2 id="tl-head" class="section-title" style="font-size:16px">Career timeline, with outcomes</h2>
      </div>
      <div class="card-body">
        ${profile.timeline.map((row) => html`
          <div class="timeline-row">
            <div class="timeline-period">${row.period}</div>
            <div class="grow">
              <p class="timeline-role">${row.role}</p>
              <p class="timeline-org">${row.org}</p>
              <p class="timeline-outcome">${row.outcome}</p>
            </div>
          </div>
        `)}
      </div>
      <div class="card-foot">
        Each role states an outcome rather than a list of responsibilities. Responsibilities describe a
        job description; outcomes describe you.
      </div>
    </section>
  `;
}

function writingSection(profile) {
  if (!profile.articles || !profile.articles.length) return html``;
  const nudge = profile.articleNudge;
  return html`
    <section class="card" id="articles" aria-labelledby="wr-head">
      <div class="card-head">
        <h2 id="wr-head" class="section-title" style="font-size:16px">Writing and published work</h2>
        <span class="tag tag-accent">Not featured on your profile</span>
      </div>
      <div class="divide">
        ${profile.articles.map((a) => html`
          <div class="card-pad">
            <p style="font-family:var(--serif);font-size:15px;font-weight:600;line-height:1.35">${a.title}</p>
            <p class="tiny muted" style="margin-top:4px">${a.date}</p>
            <p class="small secondary" style="margin-top:6px">${a.signal}</p>
          </div>
        `)}
      </div>
      ${nudge ? html`
        <div class="card-body" style="border-top:1px solid var(--border)">
          <p class="reason">
            ${icon('lightbulb', 13)}
            <span>${nudge.reason}</span>
          </p>
          <button type="button" class="btn btn-primary btn-sm" style="margin-top:12px"
            ${action('feature-article')}>${nudge.cta}</button>
        </div>
      ` : ''}
    </section>
  `;
}

function mentorshipSection(profile) {
  return html`
    <section class="card" aria-labelledby="mt-head">
      <div class="card-head">
        <h2 id="mt-head" class="section-title" style="font-size:16px">Mentorship and recommendations</h2>
      </div>
      <div class="card-body">
        ${evidenceList(profile.mentorship, 'pos')}
        <p class="reason reason-plain" style="margin-top:13px">
          ${icon('info', 13)}
          <span>${profile.mentorshipNote}</span>
        </p>
        <div class="btn-row" style="margin-top:12px">
          <button type="button" class="btn btn-sm" ${action('confirm-mentees')}>Ask for the missing confirmations</button>
        </div>
      </div>
      <div class="card-foot">
        Recommendations are not solicited by the product. There is no "endorse each other" prompt here,
        because reciprocal endorsement measures politeness rather than skill.
      </div>
    </section>
  `;
}

function communitiesSection(profile) {
  return html`
    <section class="card" aria-labelledby="cm-head">
      <div class="card-head">
        <h2 id="cm-head" class="section-title" style="font-size:16px">Professional communities</h2>
      </div>
      <div class="card-body">
        <div class="stack-sm">
          ${profile.communities.map((c) => html`
            <div class="row-between wrap">
              <span class="small" style="font-weight:500">${c.name}</span>
              <span class="tiny mono muted">${c.yourRole}</span>
            </div>
          `)}
        </div>
      </div>
    </section>
  `;
}

/**
 * Availability. A person with nothing on the market says so, rather than being
 * given an "open to" list they never wrote.
 */
function availabilityCard(intent, profile) {
  const g = profile.goal;
  return html`
    <section class="card" aria-labelledby="av-head">
      <div class="card-head"><h3 id="av-head">Availability and intent</h3></div>
      <div class="card-body">
        <p class="small" style="font-weight:600">${intent.label}</p>
        <p class="small secondary" style="margin-top:6px">
          ${g
            ? 'Visible to: recruiters with a verified hiring record, and hiring managers at companies you have '
              + 'named as targets. Not visible to your current employer.'
            : 'You have nothing on the market, so there is nothing to make visible. No availability signal '
              + 'is generated, and no recruiter is told otherwise.'}
        </p>
        ${g ? html`
          <p class="eyebrow" style="margin:14px 0 7px">Open to</p>
          <div class="row wrap" style="gap:4px">${g.openTo.map((t) => tag(t))}</div>
        ` : ''}
        <button type="button" class="btn btn-sm btn-block" style="margin-top:13px" ${action('availability-settings')}>
          Who can see this
        </button>
      </div>
      <div class="card-foot">
        There is no green "open to work" frame around your photo. Signalling a job search to everyone,
        including your manager, has never served the candidate.
      </div>
    </section>
  `;
}

function visitorCard(profile) {
  return html`
    <section class="card" aria-labelledby="vis-head">
      <div class="card-head"><h3 id="vis-head">Who reached your profile, and why</h3></div>
      <div class="card-body">
        ${evidenceList(profile.visitors)}
        <p class="small secondary" style="margin-top:12px">${profile.visitorNote}</p>
      </div>
      <div class="card-foot">
        Individual viewers are never named, and there is no upsell to unlock them. What is useful is the
        pattern, not the identity.
      </div>
    </section>
  `;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
function count(n) {
  return WORDS[n] || String(n);
}
