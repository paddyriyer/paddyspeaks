/**
 * Privacy Console — the browser app at paddyspeaks.com/privacy/
 *
 * This is not a demo or a mock. It imports the *same* engine modules the
 * command-line agent uses, straight from `privacy-agent/src/core/`, because
 * those are pure ES modules with no Node dependencies. One source of truth, so
 * the scoring you see here cannot drift from the scoring the CLI does.
 *
 * What runs here genuinely runs here: name/phone/address permutation, the
 * identity graph, match confidence, privacy risk, duplicate grouping,
 * jurisdiction detection, removability classification and query generation.
 *
 * What a static page cannot do is drive Chrome or fetch third-party pages
 * (CORS forbids it). So the division of labour is: **the console does the
 * thinking, you do the clicking.** It hands you the exact searches to run and
 * reads back whatever you paste. The judgement — is this me, how bad is it,
 * can it be removed, what do I say — is all here.
 *
 * Storage is `localStorage` on this origin. The only network calls this file
 * makes are to the site's own Worker for "Scan for me" — everything else,
 * including every judgement, happens locally. The paste flow makes none at all.
 */

import { buildProfile, parseAddress } from '../privacy-agent/src/core/identity.js';
import { IdentityGraph } from '../privacy-agent/src/core/graph.js';
import { scoreMatch, CLASSIFICATION } from '../privacy-agent/src/core/match.js';
import { buildQueries } from '../privacy-agent/src/core/queries.js';
import { riskOf, exposureScore, prioritize } from '../privacy-agent/src/core/risk.js';
import { groupDuplicates } from '../privacy-agent/src/core/dedupe.js';
import { classifyRemovability, siteKindFor } from '../privacy-agent/src/core/removability.js';
import { detectJurisdiction, preferredChoices } from '../privacy-agent/src/core/jurisdiction.js';
import { STATE, STATE_LABELS, transition, summarize } from '../privacy-agent/src/core/states.js';
import { fnv1a, registrableDomain } from '../privacy-agent/src/core/text.js';
import { extractFromPage, extractSearchResults } from '../privacy-agent/src/discover/extract.js';
import { attackSurface } from '../privacy-agent/src/core/attack-surface.js';
import { explainExposure } from '../privacy-agent/src/core/explain.js';
import { findOptOutLinks, optOutSearches } from '../privacy-agent/src/core/optout.js';
import { bulkRemovalFor, coveredByBulk } from '../privacy-agent/src/core/bulk-removal.js';
import { GROUPS, normalizeAnswers, assessCoverage } from '../privacy-agent/src/onboarding/interview.js';

const KEY = 'ps-privacy-v1';

// The Worker lives on its own subdomain, not under paddyspeaks.com/api/*.
// paddyspeaks.com is GitHub Pages, so a relative /api/scan resolves to a static
// 404 — which is exactly how the first live scan came back "0 found" with a row
// of green ticks. Same constant as lib/ps-forms.js and analytics/index.html;
// they are the reason this convention exists.
const API_BASE = 'https://ps.paddyspeaks.com';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------- state */

const state = load() || { answers: {}, profile: null, exposures: [], searched: [] };

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota / private mode */ }
}

/** The graph is derived, never persisted — cheap to rebuild, avoids stale copies. */
function graph() {
  return state.profile ? new IdentityGraph().seed(state.profile) : null;
}

/* --------------------------------------------------------- step nav */

function showStep(id) {
  for (const b of document.querySelectorAll('.step-btn')) {
    b.setAttribute('aria-selected', String(b.dataset.step === id));
  }
  for (const p of document.querySelectorAll('.panel')) {
    p.hidden = p.id !== `p-${id}`;
  }
  if (id === 'plan') renderPlan();
  if (id === 'board') renderBoard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

for (const b of document.querySelectorAll('.step-btn')) {
  b.addEventListener('click', () => showStep(b.dataset.step));
}

function markDone() {
  document.querySelector('[data-step="identity"]').classList.toggle('done', Boolean(state.profile));
  document.querySelector('[data-step="plan"]').classList.toggle('done', state.searched.length > 0);
  document.querySelector('[data-step="check"]').classList.toggle('done', state.exposures.length > 0);
}

/* ------------------------------------------------- 1. the interview */

function renderGroups() {
  $('#groups').innerHTML = GROUPS.map((g, i) => `
    <details class="grp"${i === 0 ? ' open' : ''}>
      <summary>${esc(g.title)}</summary>
      <div class="body">
        <p class="why" style="margin-top:0">${esc(g.intro)}</p>
        ${g.questions.map((q) => `
          <div class="q">
            <label for="f-${q.key}">${esc(q.prompt)}
              <span class="opt">${q.required ? '' : '· optional'}${q.type === 'list' ? ' · comma-separated' : ''}</span>
            </label>
            <p class="why">${esc(q.why)}</p>
            <input type="${inputType(q)}" id="f-${q.key}" data-key="${q.key}"
                   value="${esc(valueFor(q))}" autocomplete="off"
                   placeholder="${esc(q.example || '')}">
          </div>`).join('')}
      </div>
    </details>`).join('');

  for (const el of document.querySelectorAll('#groups input')) {
    el.addEventListener('input', () => {
      state.answers[el.dataset.key] = el.value;
      save();
    });
  }
}

function inputType(q) {
  return { email: 'email', phone: 'tel', year: 'number', number: 'number' }[q.type] || 'text';
}
function valueFor(q) {
  const v = state.answers[q.key];
  return Array.isArray(v) ? v.join(', ') : (v ?? '');
}

$('#build').addEventListener('click', () => {
  const answers = normalizeAnswers(state.answers);
  const coverage = assessCoverage(answers);

  if (!coverage.ok) {
    $('#coverage').innerHTML = `<div class="warnbox">${esc(coverage.gaps.join(' '))}</div>`;
    return;
  }

  state.profile = buildProfile(answers);
  save();

  $('#coverage').innerHTML = `
    <div class="${coverage.strength >= 70 ? 'okbox' : 'warnbox'}">
      <b>Coverage: ${coverage.strength}%</b> — ${esc(coverage.summary)}
      ${coverage.gaps.length ? `<ul style="margin:8px 0 0;padding-left:20px">${
        coverage.gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
    </div>`;

  renderProfile();
  renderAttackSurface();
  renderGraph();
  markDone();
  $('#profile-card').hidden = false;
  $('#surface-card').hidden = false;
  $('#graph-card').hidden = false;
  $('#surface-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function renderProfile() {
  const p = state.profile;
  if (!p) return;
  const g = graph();

  const block = (label, list, note) => {
    if (!list?.length) return '';
    return `<div style="margin-bottom:16px">
      <div style="font-weight:650;font-size:14.5px">${esc(label)}
        <span class="opt">· ${list.length}</span></div>
      ${note ? `<p class="why" style="margin:2px 0 0">${esc(note)}</p>` : ''}
      <div class="chips">${list.slice(0, 18).map((v) =>
        `<span class="chip" title="confidence ${v.confidence}">${esc(v.value)}</span>`).join('')}
        ${list.length > 18 ? `<span class="chip">+${list.length - 18} more</span>` : ''}</div>
    </div>`;
  };

  $('#profile-out').innerHTML =
    block('Name forms', p.names, 'Initials, reversals, nicknames and punctuation variants — records rarely use the form you write yourself.')
    + block('Phone formats', p.phones, 'Search engines index the punctuation as written, so each format finds different pages.')
    + block('Email aliases', p.emails)
    + block('Address forms', p.addresses, 'Abbreviated and expanded — brokers are wildly inconsistent about "Street" versus "St".')
    + block('Handle guesses', p.usernames, 'Speculative by design. These get searched, and most of what they turn up gets rejected.')
    + `<p class="note"><b>${g.size()} identifiers</b> now in your identity graph. Every one becomes a search input.</p>`;
}

/**
 * The attack surface — the answer to "so what?".
 *
 * A meter, not a dial. "A single ratio against a limit" is a meter; angle is
 * harder to read than length, and a gauge buys decoration at the cost of
 * accuracy. Status colours are always paired with a text band, because two of
 * the four are deliberately sub-3:1 on a light surface — colour never carries
 * the meaning alone.
 */
function renderAttackSurface() {
  if (!state.profile) return;
  const s = attackSurface(state.profile, state.exposures);

  $('#as-score').textContent = s.overall;
  $('#as-score').className = `score-n b-${s.band}`;
  $('#as-band').className = `score-band b-${s.band}`;
  $('#as-band').innerHTML = `<span class="dot"></span>${esc(s.band)} exposure`;
  $('#as-meter').className = `meter b-${s.band}`;
  requestAnimationFrame(() => { $('#as-meter').querySelector('i').style.width = `${s.overall}%`; });

  $('#as-summary').innerHTML = s.impersonation.feasible
    ? `<b>Here is how someone would impersonate you.</b>
       <ol style="margin:10px 0 0;padding-left:20px">${
         s.impersonation.steps.map((x) => `<li style="margin:4px 0">${esc(x)}</li>`).join('')}</ol>
       <p style="margin:12px 0 0"><b>${esc(s.impersonation.payoff)}</b></p>`
    : `<p style="margin:0">${esc(s.impersonation.summary)}</p>`;

  $('#as-dims').innerHTML = s.dimensions.map((d) => `
    <div class="dim b-${d.band}">
      <div class="dim-label">${esc(d.label)}<span class="dim-attack">${esc(d.attack)}</span></div>
      <div class="dim-track"><i data-w="${d.score}" style="width:0"></i></div>
      <div class="dim-val">${d.score}<span class="tag">${esc(d.band)}</span></div>
      <p class="dim-why">${esc(d.explanation)}</p>
    </div>`).join('');
  requestAnimationFrame(() => {
    for (const el of document.querySelectorAll('#as-dims .dim-track > i')) {
      el.style.width = `${el.dataset.w}%`;
    }
  });

  $('#as-caveat').textContent = s.caveat || '';
}

/**
 * The identity graph, drawn.
 *
 * A radial layout rather than a force simulation: deterministic, so the picture
 * does not rearrange itself between renders, and legible at a glance. "You" sits
 * at the centre; each identifier type gets its own arc.
 */
function renderGraph() {
  const g = graph();
  if (!g) return;

  const TYPES = [
    { type: 'address',  color: 'var(--critical)', label: 'Addresses' },
    { type: 'phone',    color: 'var(--serious)',  label: 'Phones' },
    { type: 'email',    color: 'var(--warning)',  label: 'Emails' },
    { type: 'relative', color: '#9085e9',         label: 'Relatives' },
    { type: 'name',     color: 'var(--gold)',     label: 'Name forms' },
    { type: 'username', color: '#3987e5',         label: 'Usernames' },
    { type: 'employer', color: '#1baf7a',         label: 'Employers' },
  ];

  const groups = TYPES.map((t) => ({ ...t, nodes: g.byType(t.type).slice(0, 9) }))
    .filter((t) => t.nodes.length);
  if (!groups.length) return;

  const W = 900; const H = 470; const CX = W / 2; const CY = H / 2;
  const total = groups.reduce((n, t) => n + t.nodes.length, 0);

  let i = 0;
  const edges = []; const dots = [];
  for (const grp of groups) {
    for (const node of grp.nodes) {
      // Golden-angle-ish distribution keeps labels from colliding, and two
      // radii stop the ring reading as a single dense circle.
      const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
      const radius = 118 + (i % 2 ? 74 : 22);
      const x = CX + Math.cos(angle) * radius * 1.55;
      const y = CY + Math.sin(angle) * radius;
      const r = 4 + Math.round((node.confidence || 0.5) * 3.5);
      const flip = x < CX;

      edges.push(`<path class="g-edge" d="M${CX} ${CY} Q ${(CX + x) / 2} ${(CY + y) / 2 + 18} ${x} ${y}"/>`);
      dots.push(`<g class="g-node">
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${grp.color}"/>
        <text x="${(x + (flip ? -(r + 6) : r + 6)).toFixed(1)}" y="${(y + 3.5).toFixed(1)}"
              text-anchor="${flip ? 'end' : 'start'}">${esc(short(node.value))}</text>
      </g>`);
      i += 1;
    }
  }

  $('#graph-svg').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img"
         aria-label="Identity graph: ${total} identifiers connected to you">
      ${edges.join('')}
      ${dots.join('')}
      <g class="g-node g-you">
        <circle cx="${CX}" cy="${CY}" r="26"/>
        <text x="${CX}" y="${CY + 4}" text-anchor="middle">YOU</text>
      </g>
    </svg>`;

  $('#graph-legend').innerHTML = groups.map((t) =>
    `<span><i style="background:${t.color}"></i>${esc(t.label)} · ${t.nodes.length}</span>`).join('')
    + `<span style="margin-left:auto;color:var(--ink-3)">${total} identifiers · dot size = confidence</span>`;
}

function short(v) {
  const s = String(v);
  return s.length > 22 ? `${s.slice(0, 21)}…` : s;
}

$('#clear-id').addEventListener('click', () => {
  if (!confirm('Clear the identity details you have typed?')) return;
  state.answers = {};
  state.profile = null;
  save();
  renderGroups();
  $('#coverage').innerHTML = '';
  $('#profile-card').hidden = true;
  $('#surface-card').hidden = true;
  $('#graph-card').hidden = true;
  markDone();
});

/* -------------------------------------------------- 2. search plan */

function renderPlan() {
  const g = graph();
  if (!g) {
    $('#plan-out').innerHTML = '<div class="empty">Build your profile first.</div>';
    return;
  }

  const engine = $('#engine').value;
  const queries = buildQueries(g, state.profile, { budget: 60 });

  $('#plan-out').innerHTML = `
    <p class="note" style="margin-top:0"><b>${queries.length} searches</b>, most identifying
    first. Open one, then paste what you find into step 3.</p>
    <ul class="qlist">${queries.map((q) => `
      <li class="qrow${state.searched.includes(q.id) ? ' searched' : ''}" data-q="${q.id}">
        <div class="qt">
          <code>${esc(q.text)}</code>
          <div class="qk">${esc(q.why || kindLabel(q.kind))}</div>
        </div>
        <a class="btn sm" target="_blank" rel="noopener noreferrer"
           href="${engine}${encodeURIComponent(q.text)}" data-run="${q.id}">Search →</a>
      </li>`).join('')}
    </ul>`;

  for (const a of document.querySelectorAll('[data-run]')) {
    a.addEventListener('click', () => {
      if (!state.searched.includes(a.dataset.run)) {
        state.searched.push(a.dataset.run);
        save();
        a.closest('.qrow').classList.add('searched');
        markDone();
      }
    });
  }
}

$('#engine').addEventListener('change', renderPlan);

function kindLabel(kind) {
  return {
    broker_shape: 'Finds data-broker listings as a class — start here',
    email_exact: 'Email only — very few people match this',
    phone_exact: 'Phone only — finds listings indexed by number, not name',
    address_exact: 'Address only',
    name_address: 'Name + address',
    name_phone: 'Name + phone',
    username_exact: 'Username',
    name_relative: 'Name + relative',
    name_city_age: 'Name + city + age',
    name_employer: 'Name + employer',
    name_city: 'Name + city',
    name_document: 'Documents (PDF, spreadsheets, rosters)',
    profile_url: 'Known profile',
    domain_reverse: 'Domain lookup',
    name_bare: 'Name alone — noisiest, run last',
  }[kind] || kind;
}

/* ------------------------------------------------ 3. check a result */

/* ------------------------------------------------- autonomous scan mode */

/**
 * Run the search plan server-side.
 *
 * This is the only place the console talks to a network, and it exists because
 * a browser page cannot fetch other sites. The Worker runs the searches and
 * returns text; every judgement — whether a record is the user, how risky it
 * is, whether it can be removed — still happens here, locally.
 *
 * The identity data leaves the browser in the queries themselves. That is
 * unavoidable and it is disclosed on the page rather than buried; the paste
 * flow remains for anyone who would rather it did not happen at all.
 */
let scanning = false;

$('#scan-go')?.addEventListener('click', async () => {
  const out = $('#scan-out');
  const prog = $('#scan-progress');

  if (!state.profile) {
    out.innerHTML = '<div class="warnbox">Build your identity profile in step 1 first.</div>';
    return;
  }

  scanning = true;
  $('#scan-go').disabled = true;
  $('#scan-stop').hidden = false;
  out.innerHTML = '';
  $('#scan-progress').innerHTML = '<p class="note" style="margin-top:14px">Checking the scan service…</p>';

  // Preflight. Diagnosing "is it deployed / is the key set" before burning 24
  // searches is the difference between a useful error and a blank result.
  try {
    const st = await fetch(`${API_BASE}/api/scan/status`);
    if (!st.ok) throw new Error(`HTTP ${st.status}`);
    const info = await st.json();
    if (!info.configured) {
      $('#scan-progress').innerHTML = '';
      out.innerHTML = `<div class="warnbox"><b>Scanning is not switched on.</b>
        The scan service is reachable but has no search key configured. Use
        <i>Paste your search results</i> below — it needs no server.</div>`;
      return endScan();
    }
  } catch (err) {
    $('#scan-progress').innerHTML = '';
    out.innerHTML = `<div class="warnbox"><b>The scan service is not reachable
      (${esc(err.message)}).</b>
      <p style="margin:8px 0 0">On this site <code>/api/*</code> is served by a Cloudflare
      Worker, so <code>/api/scan</code> only answers if the Worker's route covers it. If
      <code>/api/stats</code> works but this does not, the route pattern is probably matching
      specific paths rather than <code>/api/*</code>.</p>
      <p style="margin:8px 0 0">Your data is fine — use <i>Paste your search results</i>
      below meanwhile.</p></div>`;
    return endScan();
  }

  const g = graph();
  // Do NOT skip queries already opened manually in step 2 — clicking a link
  // there means "I looked", not "the scan has this covered", and filtering
  // them out silently shrinks the scan for anyone who browsed the plan first.
  const queries = buildQueries(g, state.profile, { budget: 24 });
  let queriesRun = 0;

  const steps = [];
  const draw = () => {
    prog.innerHTML = `<div style="margin-top:16px">
      ${steps.map((s) => `<div class="note" style="margin:3px 0">
        ${s.error ? '<span style="color:var(--bad)">✕</span>'
          : s.done ? '<span style="color:var(--ok)">✓</span>'
          : '<span class="spin">•</span>'}
        ${esc(s.label)}${s.error ? ` — <span style="color:var(--bad)">${esc(s.error)}</span>`
          : s.found != null ? ` — <b>${s.found}</b> found` : ''}
      </div>`).join('')}
    </div>`;
  };

  const found = [];
  const failures = [];
  let quotaHit = false;

  // Batched so one stall cannot hold the whole run, and so progress is visible.
  for (let i = 0; i < queries.length && scanning; i += 6) {
    const batch = queries.slice(i, i + 6);
    const step = { label: describeBatch(batch), done: false };
    steps.push(step);
    draw();

    let data;
    try {
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: batch.map((q) => q.text) }),
      });
      const raw = await res.text();
      try {
        data = JSON.parse(raw);
      } catch {
        // An HTML error page rather than JSON — almost always the route not
        // being served. Reporting that as "0 found" would be a lie.
        step.done = true;
        step.error = res.status === 404
          ? 'The scan route returned 404 — the Worker is not serving /api/scan.'
          : `The server returned ${res.status} instead of results.`;
        failures.push(step.error);
        draw();
        continue;
      }

      if (res.status === 503 || data.error === 'not_configured') {
        prog.innerHTML = '';
        out.innerHTML = `<div class="warnbox"><b>Scanning is not switched on for this site.</b>
          Nothing is broken — use <i>Paste your search results</i> below, which does the same
          job and sends nothing anywhere.</div>`;
        return endScan();
      }
    } catch (err) {
      step.done = true;
      step.error = `Could not reach the scan service (${err.message || 'network error'}).`;
      failures.push(step.error);
      draw();
      continue;
    }

    // Surface per-query failures. Silently counting a 401 as "no results" is
    // how a rejected API key looks exactly like a clean footprint.
    for (const r of data.results || []) {
      if (r.error === 'quota_exceeded') quotaHit = true;
      else if (r.error) failures.push(searchErrorText(r.error, data.provider));
      for (const item of r.items || []) found.push(item);
    }
    for (const q of batch) state.searched.push(q.id);
    queriesRun += batch.length;

    step.done = true;
    step.found = (data.results || []).reduce((n, r) => n + (r.items || []).length, 0);
    draw();
    save();
  }

  // Score every result. Snippets alone are often decisive, because a broker
  // snippet *is* the record.
  const scored = dedupeByDomain(found).map((r) => {
    const extracted = extractFromPage({ url: r.url, title: r.title, text: `${r.title}\n${r.snippet}` });
    const match = scoreMatch(extracted.record, state.profile);
    const removability = classifyRemovability(
      { url: r.url, title: r.title, text: `${r.title} ${r.snippet}`, fields: extracted.fields },
      state.profile,
    );
    return {
      ...r,
      extracted,
      match,
      removability,
      risk: riskOf({
        fields: extracted.fields,
        siteKind: siteKindFor(removability.category),
        matchScore: match.score,
      }),
    };
  }).filter((s) => s.match.classification !== CLASSIFICATION.FALSE)
    .sort((a, b) => b.match.score - a.match.score);

  // Everything confident goes straight onto the board; the rest is offered.
  let auto = 0;
  for (const s of scored) {
    if (s.match.classification === CLASSIFICATION.CONFIRMED) {
      trackScanned(s, STATE.CONFIRMED_EXPOSURE);
      auto += 1;
    }
  }
  save();
  markDone();

  const unsure = scored.filter((s) => s.match.classification !== CLASSIFICATION.CONFIRMED);

  const uniqueFailures = [...new Set(failures)];
  const everythingFailed = uniqueFailures.length > 0 && found.length === 0;

  out.innerHTML = `
    <div class="${everythingFailed || !auto ? 'warnbox' : 'okbox'}" style="margin-top:16px">
      ${everythingFailed
        ? `<b>The scan could not run.</b> No searches completed, so this is not a result —
           it says nothing about your footprint.
           <ul style="margin:8px 0 0;padding-left:20px">${
             uniqueFailures.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`
        : `<b>Scan complete.</b> Ran ${queriesRun} searches and read ${found.length} results.
           ${auto} confirmed as you and added to your exposures${unsure.length
             ? `, ${unsure.length} need your eye` : ''}.
           ${uniqueFailures.length ? `<br><br><b>Some searches failed:</b> ${esc(uniqueFailures[0])}` : ''}
           ${!found.length && !uniqueFailures.length
             ? '<br><br>Nothing came back at all, which is unusual — try the paste flow below to sanity-check it.' : ''}`}
      ${quotaHit ? '<br><br><b>Daily search limit reached.</b> Google\'s free tier allows 100 searches a day. Come back tomorrow to continue, or paste results below in the meantime.' : ''}
    </div>
    ${unsure.length ? `<p class="note"><b>Not sure about these — is this you?</b></p>
      ${unsure.map((s, i) => `
        <div class="exp" data-u="${i}">
          <div class="exp-h"><b>${esc(s.domain || registrableDomain(s.url))}</b>
            <span class="pill ${riskPill(s.risk.band)}">risk ${s.risk.score}</span>
            <span class="pill g">${Math.round(s.match.score * 100)}% match</span></div>
          <div class="meta">${esc(s.title)}</div>
          <p class="note" style="margin:6px 0 0">${esc(s.match.explanation)}</p>
          <div class="btns" style="margin-top:10px">
            <button class="btn sm primary" data-uadd="${i}">Yes, that's me</button>
            <button class="btn sm" data-uskip="${i}">Not me</button>
            <a class="btn sm" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Open →</a>
          </div>
        </div>`).join('')}` : ''}
    ${auto ? '<div class="btns" style="margin-top:14px"><button class="btn primary" id="scan-board">See my exposures →</button></div>' : ''}`;

  for (const btn of out.querySelectorAll('[data-uadd]')) {
    btn.addEventListener('click', () => {
      trackScanned(unsure[Number(btn.dataset.uadd)], STATE.CONFIRMED_EXPOSURE);
      save(); markDone();
      btn.closest('.btns').innerHTML = '<span class="pill ok">Added</span>';
    });
  }
  for (const btn of out.querySelectorAll('[data-uskip]')) {
    btn.addEventListener('click', () => {
      trackScanned(unsure[Number(btn.dataset.uskip)], STATE.FALSE_MATCH);
      save();
      btn.closest('.btns').innerHTML = '<span class="pill">Recorded as somebody else</span>';
    });
  }
  $('#scan-board')?.addEventListener('click', () => showStep('board'));

  endScan();
});

$('#scan-stop')?.addEventListener('click', () => { scanning = false; });

function endScan() {
  scanning = false;
  $('#scan-go').disabled = false;
  $('#scan-stop').hidden = true;
}

/** Turn a backend error code into something a person can act on. */
function searchErrorText(code, provider) {
  const name = provider === 'brave' ? 'Brave Search' : 'the search provider';
  if (/401|403/.test(code)) return `${name} rejected the API key (${code}) — check the key and that the subscription is active.`;
  if (/422/.test(code)) return `${name} rejected the query format (${code}).`;
  if (/timeout/.test(code)) return `${name} timed out.`;
  if (/network/.test(code)) return `Could not reach ${name}.`;
  return `${name} returned an error (${code}).`;
}

/** Plain-language progress. Never "priority 0.94". */
function describeBatch(batch) {
  const kinds = new Set(batch.map((q) => q.kind));
  const named = [];
  if (kinds.has('email_exact')) named.push('email address');
  if (kinds.has('phone_exact')) named.push('phone number');
  if (kinds.has('address_exact') || kinds.has('name_address')) named.push('home address');
  if (kinds.has('broker_shape')) named.push('people-search sites');
  if (kinds.has('name_relative')) named.push('family names');
  if (kinds.has('username_exact')) named.push('usernames');
  if (kinds.has('name_document')) named.push('documents and rosters');
  if (!named.length) named.push('name and location');
  return `Searching ${named.slice(0, 3).join(', ')}…`;
}

function dedupeByDomain(items) {
  const seen = new Set();
  return items.filter((i) => {
    const d = registrableDomain(i.url || '');
    if (!d || seen.has(d)) return false;
    seen.add(d);
    return true;
  });
}

function trackScanned(s, status) {
  const domain = s.domain || registrableDomain(s.url);
  const id = `exp_${fnv1a(s.url)}`;
  const jurisdiction = detectJurisdiction(state.profile.residence, s.snippet || '');
  const exposure = {
    id,
    url: s.url,
    domain,
    title: s.title,
    discoveredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    record: s.extracted.record,
    fields: s.extracted.fields,
    matchScore: s.match.score,
    classification: s.match.classification,
    evidenceOfMatch: s.match.signals,
    conflicts: s.match.conflicts,
    explanation: s.match.explanation,
    removability: s.removability,
    risk: s.risk,
    paywalled: s.extracted.paywalled,
    jurisdiction,
    privacyChoices: preferredChoices(jurisdiction.documentedProcesses || []),
    fromSnippet: true,
    status: STATE.DISCOVERED,
    history: [],
  };
  transition(exposure, status, status === STATE.FALSE_MATCH ? 'rejected by you' : 'found by the scan');
  const at = state.exposures.findIndex((x) => x.id === id);
  if (at >= 0) state.exposures[at] = exposure; else state.exposures.push(exposure);
}

/**
 * Bulk mode: read a whole search-results page.
 *
 * This is the path that matters. Asking someone to open and copy each listing
 * individually means they run the search, see their own exposure sitting there,
 * and stop — leaving the board at zero while they are looking straight at the
 * problem.
 */
$('#analyse-bulk').addEventListener('click', () => {
  const text = $('#bulk-text').value;
  const out = $('#bulk-verdict');

  if (!state.profile) {
    out.innerHTML = '<div class="warnbox">Build your identity profile in step 1 first — there is nothing to compare against.</div>';
    return;
  }
  if (!text.trim()) {
    out.innerHTML = '<div class="warnbox">Paste the search results page so there is something to read.</div>';
    return;
  }

  const found = extractSearchResults(text);
  if (!found.length) {
    out.innerHTML = `<div class="warnbox"><b>No results recognised in that paste.</b>
      Make sure you copied the whole results page rather than just the search box.
      If the engine you used copies oddly, open one listing and use the detailed
      check below instead.</div>`;
    return;
  }

  const scored = found.map((r) => {
    const extracted = extractFromPage({ url: r.url, title: r.title, text: `${r.title}\n${r.snippet}` });
    const match = scoreMatch(extracted.record, state.profile);
    const removability = classifyRemovability(
      { url: r.url, title: r.title, text: `${r.title} ${r.snippet}`, fields: extracted.fields },
      state.profile,
    );
    const risk = riskOf({
      fields: extracted.fields,
      siteKind: siteKindFor(removability.category),
      matchScore: match.score,
    });
    return { ...r, extracted, match, removability, risk };
  }).sort((a, b) => b.match.score - a.match.score);

  const likely = scored.filter((s) => s.match.classification !== CLASSIFICATION.FALSE);
  const rejected = scored.length - likely.length;

  out.innerHTML = `
    <div class="okbox" style="margin-top:18px">
      <b>Read ${scored.length} result${scored.length === 1 ? '' : 's'}.</b>
      ${likely.length} look${likely.length === 1 ? 's' : ''} like you${rejected ? `, ${rejected} rejected as somebody else` : ''}.
      Confirm the ones that are yours — anything you add is tracked through to removal.
    </div>
    ${likely.map((s, i) => `
      <div class="exp" data-i="${i}">
        <div class="exp-h">
          <b>${esc(s.domain)}</b>
          <span class="pill ${riskPill(s.risk.band)}">risk ${s.risk.score}</span>
          <span class="pill g">${Math.round(s.match.score * 100)}% match</span>
          ${s.match.classification === CLASSIFICATION.CONFIRMED
            ? '<span class="pill ok">confident</span>'
            : '<span class="pill warn">needs your eye</span>'}
        </div>
        <div class="meta">${esc(s.title || s.url)}</div>
        <p class="note" style="margin:6px 0 0">${esc(s.match.explanation)}</p>
        ${s.extracted.fields.length ? `<p class="note" style="margin:4px 0 0"><b>Exposed:</b> ${esc(s.extracted.fields.join(', '))}</p>` : ''}
        <div class="btns" style="margin-top:10px">
          <button class="btn sm primary" data-add="${i}">Yes, that's me</button>
          <button class="btn sm" data-skip="${i}">Not me</button>
          <a class="btn sm" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Open listing →</a>
        </div>
      </div>`).join('')}
    ${likely.length > 1 ? `<div class="btns" style="margin-top:14px">
      <button class="btn primary" id="add-all">Add all ${likely.length} to my exposures</button>
    </div>` : ''}`;

  const track = (s, status) => {
    const id = `exp_${fnv1a(s.url)}`;
    const jurisdiction = detectJurisdiction(state.profile.residence, s.snippet);
    const exposure = {
      id,
      url: s.url,
      domain: s.domain,
      title: s.title,
      discoveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      record: s.extracted.record,
      fields: s.extracted.fields,
      matchScore: s.match.score,
      classification: s.match.classification,
      evidenceOfMatch: s.match.signals,
      conflicts: s.match.conflicts,
      explanation: s.match.explanation,
      removability: s.removability,
      risk: s.risk,
      paywalled: s.extracted.paywalled,
      jurisdiction,
      privacyChoices: preferredChoices(jurisdiction.documentedProcesses || []),
      // Snippet-derived, so flagged: the record came from a search summary
      // rather than the page itself, which is thinner evidence.
      fromSnippet: true,
      status: STATE.DISCOVERED,
      history: [],
    };
    transition(exposure, status, status === STATE.FALSE_MATCH ? 'rejected by you' : 'confirmed by you');
    const at = state.exposures.findIndex((x) => x.id === id);
    if (at >= 0) state.exposures[at] = exposure; else state.exposures.push(exposure);
  };

  for (const btn of out.querySelectorAll('[data-add]')) {
    btn.addEventListener('click', () => {
      track(likely[Number(btn.dataset.add)], STATE.CONFIRMED_EXPOSURE);
      save(); markDone();
      btn.closest('.exp').style.opacity = '.45';
      btn.closest('.btns').innerHTML = '<span class="pill ok">Added to your exposures</span>';
    });
  }
  for (const btn of out.querySelectorAll('[data-skip]')) {
    btn.addEventListener('click', () => {
      track(likely[Number(btn.dataset.skip)], STATE.FALSE_MATCH);
      save();
      btn.closest('.exp').style.opacity = '.45';
      btn.closest('.btns').innerHTML = '<span class="pill">Recorded as somebody else</span>';
    });
  }
  $('#add-all')?.addEventListener('click', () => {
    for (const s of likely) track(s, STATE.CONFIRMED_EXPOSURE);
    save(); markDone();
    $('#bulk-text').value = '';
    showStep('board');
  });
});

$('#analyse').addEventListener('click', () => analyse($('#chk-url').value.trim(), $('#chk-text').value));

$('#try-sample').addEventListener('click', () => {
  $('#chk-url').value = 'https://example-records-finder.test/p/listing';
  $('#chk-text').value = sampleListing();
  analyse($('#chk-url').value, $('#chk-text').value);
});

/**
 * Build a sample listing from the user's *own* profile, so the demo shows a
 * true positive against their real identity rather than a canned stranger.
 * Falls back to a generic record when no profile exists yet.
 */
function sampleListing() {
  const p = state.profile;
  if (!p) {
    return `Robert James Smith, 40 - Springfield, IL
Current Address: 123 Main Street, Springfield, IL 62704
Phone: (415) 555-0142
Relatives: Mary Smith, James Smith
Previous Addresses: 45 Oak Avenue, Chicago, IL 60601
Background check available - view full report`;
  }
  const name = p.names[0]?.value || 'Unknown';
  const addr = p.addresses.find((a) => a.kind === 'address.full')?.value || p.addresses[0]?.value || '';
  const phone = p.phones.find((x) => x.kind === 'phone.formatted')?.value || p.phones[0]?.value || '';
  const age = p.birthYear ? new Date().getUTCFullYear() - p.birthYear.value : '';
  return [
    `${name}${age ? `, ${age}` : ''}`,
    addr ? `Current Address: ${addr}` : '',
    phone ? `Phone: ${phone}` : '',
    p.relatives.length ? `Relatives: ${p.relatives.map((r) => r.value).join(', ')}` : '',
    p.employers.length ? `Employer: ${p.employers[0].value}` : '',
    'People search - background check available - view full report',
  ].filter(Boolean).join('\n');
}

function analyse(url, text) {
  if (!state.profile) {
    $('#verdict').innerHTML = '<div class="warnbox">Build your identity profile in step 1 first — there is nothing to compare against.</div>';
    return;
  }
  if (!text.trim()) {
    $('#verdict').innerHTML = '<div class="warnbox">Paste the page contents so there is something to read.</div>';
    return;
  }

  const firstLine = text.trim().split('\n')[0].slice(0, 120);
  const extracted = extractFromPage({ url, title: firstLine, text });
  const match = scoreMatch(extracted.record, state.profile);
  const removability = classifyRemovability(
    { url, title: firstLine, text, fields: extracted.fields }, state.profile,
  );
  const risk = riskOf({
    fields: extracted.fields,
    siteKind: siteKindFor(removability.category),
    matchScore: match.score,
  });

  const cls = match.classification;
  const box = cls === CLASSIFICATION.CONFIRMED ? 'okbox'
    : cls === CLASSIFICATION.FALSE ? 'okbox' : 'warnbox';

  $('#verdict').innerHTML = `
    <div class="${box}" style="margin-top:20px">
      <div style="font-size:17px;font-weight:650;margin-bottom:4px">${esc(verdictHeadline(cls))}</div>
      ${esc(match.explanation)}
    </div>

    <div class="tiles" style="margin-top:16px">
      <div class="tile"><div class="n">${Math.round(match.score * 100)}%</div><div class="l">Match confidence</div></div>
      <div class="tile"><div class="n b-${risk.band}">${risk.score}</div><div class="l">Privacy risk (${risk.band})</div></div>
      <div class="tile"><div class="n">${extracted.fields.length}</div><div class="l">Details exposed</div></div>
    </div>

    ${match.signals.length ? `<p style="font-weight:650;margin-bottom:4px">Why we think it is you</p>
      <ul class="ev">${match.signals.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    ${match.conflicts.length ? `<p style="font-weight:650;margin:14px 0 4px">What does not match</p>
      <ul class="ev">${match.conflicts.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}

    <p style="font-weight:650;margin:16px 0 4px">Risk</p>
    <p class="note" style="margin-top:0">${esc(risk.explanation)}</p>

    <p style="font-weight:650;margin:16px 0 4px">Can it be removed?</p>
    <p class="note" style="margin-top:0">${esc(removability.userMessage)} ${esc(removability.note)}</p>

    ${extracted.paywalled ? `<div class="warnbox"><b>This site charges for removal
      (${esc(extracted.paywalled.price || 'price unclear')}).</b> Never pay a broker to
      delete you — most run a free opt-out they are legally required to honour. Look for
      "Do Not Sell My Personal Information" in the footer.</div>` : ''}

    <div class="btns" style="margin-top:18px">
      ${cls !== CLASSIFICATION.FALSE
        ? `<button class="btn primary" id="track">Track this exposure</button>` : ''}
      <button class="btn" id="reject">Not me — discard</button>
    </div>`;

  const saveExposure = (status) => {
    const id = `exp_${fnv1a(url || firstLine)}`;
    const existing = state.exposures.findIndex((e) => e.id === id);
    const jurisdiction = detectJurisdiction(state.profile.residence, text);
    const exposure = {
      id,
      url: url || '(no URL given)',
      domain: registrableDomain(url) || 'unknown',
      title: firstLine,
      discoveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      record: extracted.record,
      fields: extracted.fields,
      matchScore: match.score,
      classification: cls,
      evidenceOfMatch: match.signals,
      conflicts: match.conflicts,
      explanation: match.explanation,
      removability,
      risk,
      paywalled: extracted.paywalled,
      jurisdiction,
      privacyChoices: preferredChoices(jurisdiction.documentedProcesses || []),
      status: STATE.DISCOVERED,
      history: [],
    };
    transition(exposure, status, status === STATE.FALSE_MATCH ? 'rejected by you' : 'confirmed by you');
    if (existing >= 0) state.exposures[existing] = exposure;
    else state.exposures.push(exposure);
    save();
    markDone();
  };

  $('#track')?.addEventListener('click', () => {
    saveExposure(STATE.CONFIRMED_EXPOSURE);
    $('#chk-url').value = '';
    $('#chk-text').value = '';
    $('#verdict').innerHTML = '';
    showStep('board');
  });
  $('#reject').addEventListener('click', () => {
    saveExposure(STATE.FALSE_MATCH);
    $('#chk-url').value = '';
    $('#chk-text').value = '';
    $('#verdict').innerHTML = '<div class="okbox">Recorded as someone else. It will not be counted against you.</div>';
  });
}

function verdictHeadline(cls) {
  return {
    [CLASSIFICATION.CONFIRMED]: 'This is you.',
    [CLASSIFICATION.PROBABLE]: 'This is probably you.',
    [CLASSIFICATION.AMBIGUOUS]: 'This might be you — worth a look.',
    [CLASSIFICATION.FALSE]: 'This looks like somebody else.',
  }[cls];
}

/* ---------------------------------------------------- 4. the board */

/**
 * The one thing worth doing before anything else, when the law provides it.
 *
 * Working several hundred brokers one form at a time is not a task a person
 * finishes; a tool that offers only that loop is asking for something
 * impossible and calling it control. Where a single request covers everyone —
 * today, only California's DROP — it belongs above the queue, not inside it.
 *
 * The unavailable case is rendered just as fully. Someone in Ohio needs to know
 * that no such platform exists for them, and why, far more than they need an
 * empty space where the good news would have been.
 */
function renderBulk() {
  const card = $('#bulk-card');
  if (!state.profile) { card.hidden = true; return; }

  const b = bulkRemovalFor(state.profile);
  card.hidden = false;
  card.classList.toggle('is-open', Boolean(b.available));
  $('#bulk-title').textContent = b.available ? b.name : 'One request for all of them?';
  $('#bulk-headline').textContent = b.headline;

  const list = (title, items, cls = '') => (items?.length ? `
    <p class="bulk-h">${esc(title)}</p>
    <ul class="bulk-l ${cls}">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');

  const r = b.readiness;
  const readiness = r ? `
    <div class="bulk-ready">
      <p class="bulk-h" style="margin-top:0">What the form asks for</p>
      <ul class="bulk-l ok">${r.have.map((h) =>
        `<li><b>${esc(h.label)}</b> — you have this: <code>${esc(h.sample)}</code>${
          h.count > 1 ? ` and ${h.count - 1} more` : ''}</li>`).join('')}</ul>
      <ul class="bulk-l todo">${r.supply.map((s) =>
        `<li><b>${esc(s.label)}</b>${s.required ? '' : ' <span class="opt">· optional</span>'} — ${esc(s.note || s.why || '')}</li>`).join('')}</ul>
      <p class="note" style="margin-bottom:0">${esc(r.summary)}</p>
    </div>` : '';

  $('#bulk-body').innerHTML = `
    ${b.available ? `<div class="bulk-badges">
      <span class="pill ok">${esc(b.cost)}</span>
      <span class="pill g">${esc(b.authority)}</span>
      <span class="pill">${esc(b.law)}</span>
    </div>` : ''}
    ${list('How it works', b.how)}
    ${readiness}
    ${list('What it does not cover — read this part', b.doesNotCover, 'todo')}
    ${b.timing ? `<p class="note"><b>Timing.</b> ${esc(b.timing)}</p>` : ''}
    ${b.identityNote ? `<div class="warnbox"><b>It will check who you are.</b> ${esc(b.identityNote)}</div>` : ''}
    ${b.note ? `<p class="note">${esc(b.note)}</p>` : ''}
    ${b.available ? `<div class="btns" style="margin-top:16px">
      <a class="btn primary lg" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">Open the platform →</a>
      ${b.helpUrl ? `<a class="btn" href="${esc(b.helpUrl)}" target="_blank" rel="noopener noreferrer">How it works</a>` : ''}
    </div>
    <p class="note">You file it there yourself, on the state's own site. Then come back — the
    listings below that this does <i>not</i> reach are the ones still worth your time.</p>` : ''}`;
}

function renderBoard() {
  renderBulk();
  const live = state.exposures.filter((e) => e.status !== STATE.FALSE_MATCH);
  const score = exposureScore(state.exposures);
  const counts = summarize(state.exposures);

  $('#score-n').textContent = score.score;
  $('#score-n').className = `score-n b-${score.band}`;
  $('#score-t').textContent = score.explanation;

  const tiles = [
    ['Exposures found', live.length, false],
    ['Confirmed as you', counts.confirmed, false],
    ['Removal requested', counts.submitted, false],
    ['Confirmed removed', counts.completed, false],
    ['Not removable', counts.notRemovable, false],
    ['Rejected as not you', counts.falseMatches, false],
  ];
  $('#tiles').innerHTML = tiles.map(([l, n, attn]) =>
    `<div class="tile${attn && n ? ' attn' : ''}"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');

  if (!live.length) {
    // An empty board is the expected first state, not an error — but saying
    // only "nothing here" reads as a broken page. Name the next action, and
    // point at the searches most likely to actually surface a broker listing.
    const g = graph();
    const brokerQs = g ? buildQueries(g, state.profile, { budget: 60 })
      .filter((q) => q.kind === 'broker_shape').slice(0, 4) : [];
    const engine = $('#engine')?.value || 'https://duckduckgo.com/?q=';

    $('#board-out').innerHTML = `
      <div class="empty" style="text-align:left;padding:18px">
        <p style="margin-top:0"><b>Nothing tracked yet — that is the normal starting point.</b></p>
        <p>This board fills up as you check results. Nothing appears here automatically,
        because a web page cannot open other people's sites on your behalf — your browser
        blocks that, which is the same rule that stops any site reading your other tabs.</p>
        ${brokerQs.length ? `
          <p style="margin-bottom:6px"><b>Start with these.</b> They look for the phrases
          every people-search listing is built from, so they surface broker pages as a
          group rather than one site at a time:</p>
          <ul class="qlist" style="font-style:normal">
            ${brokerQs.map((q) => `
              <li class="qrow">
                <div class="qt"><code>${esc(q.text)}</code>
                  <div class="qk">${esc(q.why || 'broker-shaped search')}</div></div>
                <a class="btn sm" target="_blank" rel="noopener noreferrer"
                   href="${engine}${encodeURIComponent(q.text)}">Search →</a>
              </li>`).join('')}
          </ul>
          <p style="margin-bottom:0">Open one, copy a listing that looks like you, and paste
          it into <b>step 3</b>. The console decides whether it is really you and what can be
          done about it.</p>`
        : '<p style="margin-bottom:0">Build your identity profile in step 1 first.</p>'}
      </div>`;
    return;
  }

  // Grouped once, then handed to each card. Without the group, question 1
  // ("how did they get it?") describes a page in isolation and misses the only
  // answer that actually changes what the user should do — that this is one
  // record being resold, not twelve separate leaks.
  const groups = groupDuplicates(live);
  const groupFor = new Map();
  for (const g of groups) for (const m of g.members) groupFor.set(m.id, g);
  const dupes = groups.filter((g) => g.count > 1);

  const ordered = prioritize(live);
  const bulk = bulkRemovalFor(state.profile);
  const outside = ordered.filter((e) => !coveredByBulk(e, bulk).covered).length;

  $('#board-out').innerHTML =
    (bulk.available && ordered.length ? `<div class="okbox"><b>${
      ordered.length - outside} of these should be handled by your single request.</b> ${
      outside ? `The other ${outside} ${outside === 1 ? 'is' : 'are'} not something it reaches — those are the ones worth your own time.`
        : 'Nothing here falls outside it, so file that and re-check rather than working this list.'}</div>` : '')
    + (dupes.length ? `<div class="okbox"><b>Duplicate records spotted.</b> ${
      dupes.map((g) => esc(g.summary)).join(' ')}</div>` : '')
    // Only the top card opens its explanation by default. Expanding all of them
    // buries the priority order under a wall of prose.
    + ordered.map((e, i) => renderExposure(e, groupFor.get(e.id), i === 0, bulk)).join('');

  for (const btn of document.querySelectorAll('[data-adv]')) {
    btn.addEventListener('click', () => advance(btn.dataset.adv, btn.dataset.to));
  }
  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.addEventListener('click', () => {
      navigator.clipboard?.writeText(btn.dataset.copy);
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = 'Copy removal request'; }, 1600);
    });
  }
  for (const btn of document.querySelectorAll('[data-del]')) {
    btn.addEventListener('click', () => {
      state.exposures = state.exposures.filter((x) => x.id !== btn.dataset.del);
      save(); renderBoard(); markDone();
    });
  }
  for (const btn of document.querySelectorAll('[data-optout]')) {
    btn.addEventListener('click', () => findOptOut(btn.dataset.optout));
  }
}

/**
 * One exposure card.
 *
 * The centre of it is "Explain why you found me" — the four questions from
 * `explain.js`. Everything else on the card is status; those four are the part
 * that teaches, and the reason someone who has removed one listing understands
 * why the next eleven exist.
 *
 * They are rendered from analysis already performed — the match evidence, the
 * removability classification, the risk combinations, the duplicate group.
 * Nothing here is generated speculatively, and where the engine does not know
 * the answer it says so rather than inventing a plausible one.
 */
function renderExposure(e, group, open, bulk) {
  const cover = coveredByBulk(e, bulk);
  const [label, help] = STATE_LABELS[e.status] || [e.status, ''];
  const pill = e.status === STATE.SUCCESSFULLY_REMOVED ? 'ok'
    : e.status === STATE.NOT_REMOVABLE ? 'bad'
      : e.status === STATE.PENDING_REMOVAL ? 'warn' : 'info';
  const choices = e.privacyChoices || preferredChoices(e.jurisdiction?.documentedProcesses || []);
  const why = explainExposure(e, state.profile, { duplicateGroup: group });

  const q = (n, question, answer, extra = '') => `
    <div class="q4">
      <div class="q4-n">${n}</div>
      <div class="q4-b">
        <h5>${esc(question)}</h5>
        <p>${esc(answer)}</p>
        ${extra}
      </div>
    </div>`;

  return `<div class="exp" data-band="${esc(e.risk.band)}">
    <div class="exp-h">
      <b>${esc(e.domain)}</b>
      <span class="pill ${riskPill(e.risk.band)}">risk ${e.risk.score}</span>
      <span class="pill g">${Math.round(e.matchScore * 100)}% match</span>
      <span class="pill ${pill}" title="${esc(help)}">${esc(label)}</span>
      ${group && group.acrossSites > 1
        ? `<span class="pill warn" title="${esc(group.summary)}">1 of ${group.acrossSites} copies</span>` : ''}
      ${cover.covered ? '<span class="pill ok" title="Expected to be covered by your single request">bulk request</span>' : ''}
    </div>
    <div class="meta mono">${esc(e.url)}</div>
    ${e.fields.length ? `<div class="chips">${e.fields.map((f) =>
      `<span class="chip">${esc(fieldLabel(f))}</span>`).join('')}</div>` : ''}

    <details class="why4"${open ? ' open' : ''}>
      <summary>Explain why you found me<span class="hint">how they got it · why it is you · what it enables · fastest way out</span></summary>
      ${q(1, 'How did this site get my information?', why.howTheyGotIt.text)}
      ${q(2, 'Why does it think this record is me?', why.whyItsYou.text, `
        ${why.whyItsYou.signals.length ? `<ul class="ev">${
          why.whyItsYou.signals.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
        ${why.whyItsYou.conflicts.length ? `<ul class="ev conf">${
          why.whyItsYou.conflicts.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
        <div class="q4-meter">
          <div class="meter"><i style="width:${why.whyItsYou.confidence}%"></i></div>
          <span>${why.whyItsYou.confidence}% confident this is you</span>
        </div>`)}
      ${q(3, 'What could someone do with this?', why.whatSomeoneCouldDo.text, `
        <span class="sev s-${esc(why.whatSomeoneCouldDo.severity)}">${esc(why.whatSomeoneCouldDo.severity)}</span>
        ${why.whatSomeoneCouldDo.combinations.length > 1 ? `<ul class="ev">${
          why.whatSomeoneCouldDo.combinations.slice(1).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}`)}
      ${q(4, 'What is the fastest way to eliminate it?',
        // The bulk route, where one exists, is strictly faster than anything
        // per-site — so it leads, and the individual instructions follow as the
        // fallback rather than the plan.
        cover.covered ? cover.why : why.fastestRemoval.text, `
        ${cover.covered ? `<p class="do"><b>Then, only if it survives:</b> ${esc(why.fastestRemoval.text)}</p>`
          : cover.why ? `<p class="note" style="margin:8px 0 0">${esc(cover.why)}</p>` : ''}
        ${why.fastestRemoval.action ? `<p class="do"><b>Do this:</b> ${esc(why.fastestRemoval.action)}</p>` : ''}
        ${choices.choices?.length ? `<p class="do">${esc(choices.rationale)}</p>` : ''}`)}
    </details>

    ${renderTimeline(e)}

    <div class="btns" style="margin-top:12px">
      ${e.removability.removable && e.status === STATE.CONFIRMED_EXPOSURE ? `
        <button class="btn sm" data-optout="${e.id}">Find the opt-out</button>
        <button class="btn sm" data-copy="${esc(requestText(e))}">Copy removal request</button>
        <button class="btn sm" data-adv="${e.id}" data-to="${STATE.PENDING_REMOVAL}">I submitted it</button>` : ''}
      ${e.status === STATE.PENDING_REMOVAL ? `
        <a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(e.url)}">Re-check the page →</a>
        <button class="btn sm" data-adv="${e.id}" data-to="${STATE.SUCCESSFULLY_REMOVED}">It's gone</button>` : ''}
      ${!e.removability.removable && e.status === STATE.CONFIRMED_EXPOSURE ? `
        <button class="btn sm" data-adv="${e.id}" data-to="${STATE.NOT_REMOVABLE}">Acknowledge</button>` : ''}
      <button class="btn sm" data-del="${e.id}">Remove from list</button>
    </div>
    <div class="oo" id="oo-${e.id}"></div>
  </div>`;
}

/**
 * Find the removal route by reading the listing's own links.
 *
 * The previous version fired one search — `site:x.com opt out OR "do not sell"
 * OR "remove my information"` — which looks thorough and returns nothing,
 * because engines do not mix bare terms with quoted OR groups the way that
 * query assumes. Worse, a broker's listing page is frequently not indexed at
 * all, so no query against it can ever succeed.
 *
 * Reading the page is both more reliable and more correct: several
 * jurisdictions require the opt-out to be linked from every page, so the answer
 * is usually sitting in the footer of the exact page holding the record. No URL
 * is guessed at, and nothing here knows the name of a single broker.
 */
async function findOptOut(id) {
  const e = state.exposures.find((x) => x.id === id);
  const box = $(`#oo-${CSS.escape(id)}`);
  if (!e || !box) return;

  const searches = optOutSearches(e.domain);
  const engine = $('#engine')?.value || 'https://duckduckgo.com/?q=';
  const searchList = (intro) => `
    <p class="note" style="margin:0 0 8px">${intro}</p>
    <ul class="qlist">${searches.map((s) => `
      <li class="qrow">
        <div class="qt"><code>${esc(s.text)}</code><div class="qk">${esc(s.why)}</div></div>
        <a class="btn sm" target="_blank" rel="noopener noreferrer"
           href="${engine}${encodeURIComponent(s.text)}">Search →</a>
      </li>`).join('')}</ul>`;

  box.innerHTML = '<p class="note"><span class="spin">•</span> Reading the page for its own opt-out link…</p>';

  let data;
  try {
    const res = await fetch(`${API_BASE}/api/scan/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: e.url }),
    });
    data = await res.json();
  } catch (err) {
    box.innerHTML = `<div class="oo-box">${searchList(
      `<b>Could not reach the page (${esc(err.message || 'network error')}).</b> Try these instead — each is simple enough for any engine to answer:`,
    )}</div>`;
    return;
  }

  if (data?.error) {
    box.innerHTML = `<div class="oo-box">${searchList(
      `<b>The page could not be read (${esc(data.error)}).</b> Brokers often block automated reads — that is normal, and these searches are the way round it:`,
    )}</div>`;
    return;
  }

  const found = findOptOutLinks(data.links || [], data.url || e.url);
  if (!found.length) {
    box.innerHTML = `<div class="oo-box">${searchList(
      '<b>The page publishes no opt-out link.</b> That is itself worth knowing — several US state laws require one. Try these, and if nothing turns up, the privacy policy usually names an address to write to:',
    )}</div>`;
    return;
  }

  box.innerHTML = `<div class="oo-box">
    <p class="note" style="margin:0 0 10px"><b>Found ${found.length} route${found.length === 1 ? '' : 's'}
    on the page itself.</b> Try them in this order — the first is the most direct.</p>
    <ul class="qlist">${found.slice(0, 6).map((r) => `
      <li class="qrow">
        <div class="qt">
          <code>${esc(r.text)}</code>
          <div class="qk">${esc(r.why)}${r.sameSite ? '' : ' · hosted off-site, which is normal for privacy portals'}</div>
        </div>
        <a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(r.url)}">Open →</a>
      </li>`).join('')}</ul>
    <p class="note">Once you have submitted it, come back and press <b>I submitted it</b> — that
    starts the clock, and the console will remind you that submitted is not removed.</p>
  </div>`;
}

/**
 * The removal journey, from the exposure's own history.
 *
 * This is the honest version of a progress bar: it shows what actually
 * happened and when, so "request submitted" cannot be mistaken for "removed" —
 * those are two separate stops with a verification step between them, and the
 * gap between the timestamps is the wait the user is actually in.
 */
function renderTimeline(e) {
  // The state machine insists on passing through "removal path found" and
  // "submitting" on the way to "submitted", so one click writes four entries in
  // the same second. Those are bookkeeping, not events the user lived through —
  // a step is only drawn when it is the last thing that happened at that moment.
  const all = (e.history || []).filter((h) => h.to !== h.from);
  const steps = all.filter((h, i) => !all[i + 1] || all[i + 1].at !== h.at);
  if (!steps.length) return '';

  const rows = [
    { label: 'Found', note: e.fromSnippet ? 'Spotted in a search result' : 'Checked in detail', at: e.discoveredAt },
    ...steps.map((h) => ({ label: (STATE_LABELS[h.to] || [h.to])[0], note: h.note, at: h.at })),
  ];

  // What has not happened yet matters as much as what has: an exposure sitting
  // at "awaiting removal" needs the unfinished step drawn, not a tidy full bar.
  const pending = e.status === STATE.PENDING_REMOVAL || e.status === STATE.REQUEST_SUBMITTED
    ? 'Confirmed removed — not yet. Re-check the page before believing it.'
    : null;

  return `<div class="tl">
    ${rows.map((r) => `<div class="tl-row done">
      <span class="tl-dot"></span>
      <div><b>${esc(r.label)}</b>${r.note ? ` — ${esc(r.note)}` : ''}
        <span class="tl-at">${esc(when(r.at))}</span></div>
    </div>`).join('')}
    ${pending ? `<div class="tl-row"><span class="tl-dot"></span>
      <div class="tl-todo">${esc(pending)}</div></div>` : ''}
  </div>`;
}

function when(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return then.toLocaleDateString();
}

/** Field keys are engine-internal. Nobody should have to read `address_history`. */
function fieldLabel(f) {
  return {
    address: 'home address',
    address_history: 'past addresses',
    phone: 'phone number',
    email: 'email address',
    relatives: 'relatives',
    age: 'age',
    birth_date: 'date of birth',
    employer: 'employer',
    ssn_fragment: 'part of your SSN',
    property: 'property owned',
    income: 'income estimate',
    court: 'court records',
    criminal: 'criminal records',
    license: 'licence number',
    vehicle: 'vehicle records',
    neighbors: 'neighbours',
  }[f] || String(f).replace(/_/g, ' ');
}

function riskPill(band) {
  return band === 'critical' || band === 'high' ? 'bad' : band === 'moderate' ? 'warn' : 'ok';
}

/**
 * The removal request text. Deliberately plain and polite: a specific request
 * works better than a legal threat, and a statute is named only where the
 * jurisdiction engine judged it actually supportable (see jurisdiction.js).
 */
function requestText(e) {
  const p = state.profile;
  const name = p?.names[0]?.value || '';
  const addr = p?.addresses.find((a) => a.kind === 'address.full')?.value
    || p?.addresses[0]?.value || '';
  const email = p?.emails[0]?.value || '';
  const citable = (e.jurisdiction?.recommended || []).find((r) => r.approach === 'statutory');

  return [
    `To whom it may concern,`,
    ``,
    `I am requesting the removal of my personal information from ${e.domain}.`,
    `The listing is at: ${e.url}`,
    ``,
    `It publishes the following details about me: ${e.fields.join(', ')}.`,
    name ? `Name: ${name}` : '',
    addr ? `Address: ${addr}` : '',
    email ? `Contact email: ${email}` : '',
    ``,
    citable
      ? `I am exercising my rights under ${citable.law}, which your privacy policy acknowledges.`
      : `Please process this under your published privacy/opt-out process.`,
    ``,
    `Please confirm in writing once the record has been removed.`,
    ``,
    `Thank you,`,
    name,
  ].filter((l) => l !== '').join('\n');
}

function advance(id, to) {
  const e = state.exposures.find((x) => x.id === id);
  if (!e) return;
  try {
    // Going through the real state machine means the honest ordering is
    // enforced here too: a request cannot become "removed" without passing
    // through "submitted" and an actual re-check.
    if (to === STATE.PENDING_REMOVAL) {
      transition(e, STATE.REMOVAL_METHOD_FOUND, 'you found the opt-out');
      transition(e, STATE.FORM_IN_PROGRESS, 'filling it in');
      transition(e, STATE.REQUEST_SUBMITTED, 'you submitted the request');
      transition(e, STATE.PENDING_REMOVAL, 'waiting for the site to process it');
    } else {
      transition(e, to, 'confirmed by you');
    }
    save();
    renderBoard();
  } catch (err) {
    alert(err.message);
  }
}

/* ------------------------------------------------------ data controls */

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'privacy-console-export.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

// Two buttons, one behaviour: the handoff card needs it inline at the point of
// use, and the data card is where anyone looks for an export.
for (const id of ['#export', '#export-2']) {
  $(id)?.addEventListener('click', exportState);
}

$('#wipe').addEventListener('click', () => {
  if (!confirm('Erase your identity details and every tracked exposure from this browser?')) return;
  localStorage.removeItem(KEY);
  location.reload();
});

/* ------------------------------------------------------------ start */

renderGroups();
if (state.profile) {
  renderProfile();
  renderAttackSurface();
  renderGraph();
  $('#profile-card').hidden = false;
  $('#surface-card').hidden = false;
  $('#graph-card').hidden = false;
}
markDone();
