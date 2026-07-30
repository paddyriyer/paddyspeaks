/**
 * Dashboard customiser.
 *
 * The layout is data, so editing it is a first-class feature rather than a
 * settings page bolted on the side. Panels move with buttons rather than
 * drag-and-drop: dragging is hostile to keyboard and screen-reader users, and
 * a dashboard people rely on is exactly the wrong place to require a mouse.
 *
 * Layouts are stored per persona — a hiring manager's arrangement is not a job
 * seeker's — and a persona that has never been customised simply falls back to
 * the default the persona ships with.
 */

import { html, action } from '../dom.js';
import { state, storedLayout, hasCustomLayout } from '../store.js';
import { personaFor } from '../data/personas.js';
import { panels, regionLabels, availablePanels, sanitiseLayout } from '../data/panels.js';
import { icon } from './icons.js';

/** The layout in force: the user's if they have one, otherwise the persona's. */
export function activeLayout() {
  const p = personaFor(state.intent, state.hiringView);
  const stored = storedLayout(p.id);
  return sanitiseLayout(stored || p.layout, p.id);
}

/** The bar that turns customising on, shown above the dashboard. */
export function customiseBar() {
  const p = personaFor(state.intent, state.hiringView);
  const custom = hasCustomLayout(p.id);

  if (!state.customising) {
    return html`
      <div class="customise-bar">
        <div class="grow">
          <p class="eyebrow">Your dashboard</p>
          <p class="small secondary" style="margin-top:3px">
            ${custom
              ? `Arranged by you, for ${p.label.toLowerCase()} mode.`
              : `Default arrangement for ${p.label.toLowerCase()} mode. Every panel can be moved, added or removed.`}
          </p>
        </div>
        <div class="btn-row">
          ${custom ? html`
            <button type="button" class="btn btn-sm btn-quiet" ${action('reset-layout')}>
              Reset to default
            </button>
          ` : ''}
          <button type="button" class="btn btn-sm" ${action('toggle-customise')}>
            ${icon('layers', 13)}<span>Customise</span>
          </button>
        </div>
      </div>
    `;
  }

  const layout = activeLayout();
  return html`
    <section class="customiser" aria-label="Customise your dashboard">
      <div class="customiser-head">
        <div class="grow">
          <h2 class="section-title" style="font-size:17px">Customise your dashboard</h2>
          <p class="small secondary" style="margin-top:4px">
            Changes apply to <b>${p.label}</b> mode only, and save as you go.
            Other modes keep their own arrangement.
          </p>
        </div>
        <div class="btn-row">
          ${custom ? html`
            <button type="button" class="btn btn-sm btn-quiet" ${action('reset-layout')}>Reset to default</button>
          ` : ''}
          <button type="button" class="btn btn-primary btn-sm" ${action('toggle-customise')}>
            ${icon('check', 13)}<span>Done</span>
          </button>
        </div>
      </div>

      <div class="customiser-regions">
        ${['left', 'center', 'right'].map((region) => regionEditor(region, layout, p))}
      </div>

      <p class="customiser-note">
        ${icon('info', 13)}
        <span>
          Panels move with buttons rather than dragging, so the whole customiser works
          from the keyboard and reads correctly in a screen reader.
        </span>
      </p>
    </section>
  `;
}

function regionEditor(region, layout, persona) {
  const active = layout[region] || [];
  const all = availablePanels(persona.id, region);
  const inactive = all.filter((id) => !active.includes(id));

  return html`
    <div class="customiser-region">
      <h3 class="customiser-region-title">${regionLabels[region]}</h3>

      <ul class="panel-list">
        ${active.length === 0 ? html`
          <li class="panel-empty">Nothing here. Add a panel below.</li>
        ` : active.map((id, i) => {
          const meta = panels[id];
          return html`
            <li class="panel-row">
              <div class="grow">
                <p class="panel-name">
                  ${meta.label}
                  ${meta.required ? html`<span class="panel-locked">always on</span>` : ''}
                </p>
                <p class="panel-desc">${meta.description}</p>
              </div>
              <div class="panel-controls">
                <button type="button" class="icon-btn" ${action('move-panel', { region, id, dir: 'up' })}
                  ${i === 0 ? 'disabled' : ''} aria-label="Move ${meta.label} up">
                  <span aria-hidden="true">↑</span>
                </button>
                <button type="button" class="icon-btn" ${action('move-panel', { region, id, dir: 'down' })}
                  ${i === active.length - 1 ? 'disabled' : ''} aria-label="Move ${meta.label} down">
                  <span aria-hidden="true">↓</span>
                </button>
                ${meta.required ? '' : html`
                  <button type="button" class="icon-btn" ${action('remove-panel', { region, id })}
                    aria-label="Remove ${meta.label}">${icon('x', 15)}</button>
                `}
              </div>
            </li>
          `;
        })}
      </ul>

      ${inactive.length ? html`
        <div class="panel-add">
          <p class="eyebrow" style="margin-bottom:6px">Add to ${regionLabels[region].toLowerCase()}</p>
          <div class="filter-row">
            ${inactive.map((id) => html`
              <button type="button" class="filter-chip" ${action('add-panel', { region, id })}>
                ${icon('plus', 12)}<span style="margin-left:4px">${panels[id].label}</span>
              </button>
            `)}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
