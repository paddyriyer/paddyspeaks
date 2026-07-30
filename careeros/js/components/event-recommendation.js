/** Events — "Worth Your Time". Recommended on professional value, not attendance numbers. */

import { html, action } from '../dom.js';
import { state, isExpanded } from '../store.js';
import { personaFor } from '../data/personas.js';
import { icon } from './icons.js';
import { evidenceList, saveButton, tag, avatar } from './primitives.js';

export function eventRecommendation(event, { compact = false } = {}) {
  const open = isExpanded(`evt-att-${event.id}`);
  // You are not an attendee worth your own time.
  const self = personaFor(state.intent, state.hiringView).selfId;
  const attendees = self ? event.attendees.filter((a) => a.id !== self) : event.attendees;
  return html`
    <article class="card event" aria-labelledby="evt-${event.id}">
      <div class="row-between" style="align-items:flex-start">
        <div class="grow">
          <h3 class="event-name" id="evt-${event.id}">${event.name}</h3>
          <p class="event-when">${event.date} · ${event.location}</p>
        </div>
        ${tag(event.match, event.match === 'High value' ? 'primary' : 'accent')}
      </div>

      <p class="tiny muted" style="margin-top:7px">${event.format} · ${event.cost}</p>

      <div style="margin-top:12px">
        <p class="eyebrow" style="margin-bottom:6px">Why this is recommended</p>
        ${evidenceList(compact ? event.why.slice(0, 2) : event.why)}
      </div>

      <div class="event-actions">
        <button type="button" class="btn btn-sm" aria-expanded="${open}"
          aria-controls="evt-panel-${event.id}" ${action('toggle-expand', { id: `evt-att-${event.id}` })}>
          ${icon('users', 13)}<span>View useful attendees</span>
        </button>
        <button type="button" class="btn btn-sm" ${action('request-intro-event', { id: event.id })}>
          Ask for introductions
        </button>
        <button type="button" class="btn btn-sm" ${action('add-calendar', { id: event.id })}>
          ${icon('calendar', 13)}<span>Add to calendar</span>
        </button>
        ${saveButton('events', event.id)}
      </div>

      <div class="disclosure-panel" id="evt-panel-${event.id}" ${open ? '' : 'hidden'}>
        <h4>Attendees worth your time</h4>
        <div>
          ${attendees.map((a) => html`
            <div class="attendee">
              ${avatar(initialsOf(a.name), 'sm')}
              <span class="grow"><b>${a.name}</b> <span class="attendee-role">— ${a.role}</span></span>
            </div>
          `)}
        </div>
        <h4 style="margin-top:14px">Prepare a networking list</h4>
        ${evidenceList(event.prep)}
        <div class="btn-row" style="margin-top:12px">
          <button type="button" class="btn btn-sm btn-primary" ${action('prepare-networking', { id: event.id })}>
            Prepare networking list
          </button>
        </div>
      </div>
    </article>
  `;
}

function initialsOf(name) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('');
}
