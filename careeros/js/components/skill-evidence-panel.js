/**
 * Skills, expressed as evidence rather than endorsements. A skill nobody can
 * point at is a claim, and the panel says so plainly.
 */

import { html, action } from '../dom.js';
import { isExpanded } from '../store.js';
import { activeProfile } from '../data/profiles.js';
import { meter, evidenceList, tag } from './primitives.js';

export function skillEvidencePanel({ compact = false } = {}) {
  const skills = activeProfile().skills;
  const list = compact
    ? skills.filter((s) => s.strength !== 'Strong').concat(skills.filter((s) => s.strength === 'Strong').slice(0, 2))
    : skills;

  return html`
    <section class="card" id="skills" aria-labelledby="skills-head">
      <div class="card-head">
        <h3 id="skills-head">Skills, with evidence</h3>
        <span class="tiny muted">${skills.length} tracked</span>
      </div>
      <div class="divide">
        ${list.map((skill) => skillRow(skill))}
      </div>
      <div class="card-foot">
        Endorsements are not counted. A skill's strength comes from work someone else can read,
        peer validation, and how recently it was demonstrated.
      </div>
    </section>
  `;
}

export function skillRow(skill) {
  const open = isExpanded(`skill-${skill.id}`);
  const variant = skill.level >= 80 ? '' : skill.level >= 55 ? 'accent' : 'warning';
  const strengthTag = skill.strength === 'Strong' ? 'primary'
    : skill.strength === 'Medium' ? 'accent' : 'warning';

  return html`
    <div class="skill" id="${skill.id}">
      <div class="skill-top">
        <div class="grow">
          <p class="skill-name">${skill.name}</p>
          <div class="skill-meta">
            <span>Evidence strength: ${skill.strength}</span>
            <span>Last demonstrated: ${skill.lastDemonstrated}</span>
            ${skill.blocking ? html`<span class="mono" style="color:var(--warning)">Affects ${skill.blocking} job matches</span>` : ''}
          </div>
        </div>
        <div class="skill-strength">${tag(skill.strength, strengthTag)}</div>
      </div>
      <div style="margin-top:9px">${meter(skill.level, variant)}</div>

      <button type="button" class="disclosure-btn" style="margin-top:11px"
        aria-expanded="${open}" aria-controls="skill-panel-${skill.id}"
        ${action('toggle-expand', { id: `skill-${skill.id}` })}>
        <span class="caret" aria-hidden="true">›</span>
        <span>${open ? 'Hide the evidence' : 'What backs this up'}</span>
      </button>

      <div class="disclosure-panel" id="skill-panel-${skill.id}" ${open ? '' : 'hidden'}>
        <h4>Demonstrated by</h4>
        ${evidenceList(skill.evidence, 'pos')}
        ${skill.gaps && skill.gaps.length ? html`
          <h4 style="margin-top:14px">Gaps a hiring manager would notice</h4>
          ${evidenceList(skill.gaps, 'gap')}
        ` : ''}
        ${skill.strengthen ? html`
          <h4 style="margin-top:14px">How to strengthen this signal</h4>
          ${evidenceList(skill.strengthen)}
          <div class="btn-row" style="margin-top:12px">
            <button type="button" class="btn btn-sm btn-primary"
              ${action('strengthen-skill', { id: skill.id })}>Strengthen this skill signal</button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
