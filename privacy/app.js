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
 * Storage is `localStorage` on this origin. No network call is made by this
 * file at all; there is deliberately no `fetch` in it.
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
import { GROUPS, normalizeAnswers, assessCoverage } from '../privacy-agent/src/onboarding/interview.js';

const KEY = 'ps-privacy-v1';
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
  markDone();
  $('#profile-card').hidden = false;
  $('#profile-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

$('#clear-id').addEventListener('click', () => {
  if (!confirm('Clear the identity details you have typed?')) return;
  state.answers = {};
  state.profile = null;
  save();
  renderGroups();
  $('#coverage').innerHTML = '';
  $('#profile-card').hidden = true;
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
          <div class="qk">${esc(q.why || kindLabel(q.kind))} · priority ${q.priority}</div>
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
    const st = await fetch('/api/scan/status');
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
      const res = await fetch('/api/scan', {
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
    jurisdiction: detectJurisdiction(state.profile.residence, s.snippet || ''),
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
      jurisdiction: detectJurisdiction(state.profile.residence, s.snippet),
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
      jurisdiction: detectJurisdiction(state.profile.residence, text),
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

function renderBoard() {
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

  const dupes = groupDuplicates(live).filter((g) => g.count > 1);

  $('#board-out').innerHTML =
    (dupes.length ? `<div class="okbox"><b>Duplicate records spotted.</b> ${
      dupes.map((g) => esc(g.summary)).join(' ')}</div>` : '')
    + prioritize(live).map((e) => renderExposure(e)).join('');

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
}

function renderExposure(e) {
  const [label, help] = STATE_LABELS[e.status] || [e.status, ''];
  const pill = e.status === STATE.SUCCESSFULLY_REMOVED ? 'ok'
    : e.status === STATE.NOT_REMOVABLE ? 'bad'
      : e.status === STATE.PENDING_REMOVAL ? 'warn' : 'info';
  const choices = preferredChoices(e.jurisdiction?.documentedProcesses || []);
  const rec = e.jurisdiction?.recommended?.[0];

  return `<div class="exp">
    <div class="exp-h">
      <b>${esc(e.domain)}</b>
      <span class="pill ${riskPill(e.risk.band)}">risk ${e.risk.score}</span>
      <span class="pill g">${Math.round(e.matchScore * 100)}% match</span>
      <span class="pill ${pill}" title="${esc(help)}">${esc(label)}</span>
    </div>
    <div class="meta mono">${esc(e.url)}</div>
    <p class="note" style="margin:8px 0 0"><b>Exposed:</b> ${esc(e.fields.join(', '))}</p>
    <p class="note" style="margin:4px 0 0">${esc(e.risk.explanation)}</p>
    <p class="note" style="margin:8px 0 0"><b>Removal:</b> ${esc(e.removability.userMessage)}</p>
    ${rec ? `<p class="note" style="margin:4px 0 0"><b>Approach:</b> ${esc(rec.action)} <span style="color:var(--light-muted)">${esc(rec.why)}</span></p>` : ''}
    ${choices.choices.length ? `<p class="note" style="margin:4px 0 0"><b>Take:</b> ${esc(choices.rationale)}</p>` : ''}

    <div class="btns" style="margin-top:12px">
      ${e.removability.removable && e.status === STATE.CONFIRMED_EXPOSURE ? `
        <a class="btn sm" target="_blank" rel="noopener noreferrer"
           href="https://duckduckgo.com/?q=${encodeURIComponent(`site:${e.domain} opt out OR "do not sell" OR "remove my information"`)}">Find the opt-out →</a>
        <button class="btn sm" data-copy="${esc(requestText(e))}">Copy removal request</button>
        <button class="btn sm" data-adv="${e.id}" data-to="${STATE.PENDING_REMOVAL}">I submitted it</button>` : ''}
      ${e.status === STATE.PENDING_REMOVAL ? `
        <a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(e.url)}">Re-check the page →</a>
        <button class="btn sm" data-adv="${e.id}" data-to="${STATE.SUCCESSFULLY_REMOVED}">It's gone</button>` : ''}
      ${!e.removability.removable && e.status === STATE.CONFIRMED_EXPOSURE ? `
        <button class="btn sm" data-adv="${e.id}" data-to="${STATE.NOT_REMOVABLE}">Acknowledge</button>` : ''}
      <button class="btn sm" data-del="${e.id}">Remove from list</button>
    </div>
  </div>`;
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

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'privacy-console-export.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#wipe').addEventListener('click', () => {
  if (!confirm('Erase your identity details and every tracked exposure from this browser?')) return;
  localStorage.removeItem(KEY);
  location.reload();
});

/* ------------------------------------------------------------ start */

renderGroups();
if (state.profile) {
  renderProfile();
  $('#profile-card').hidden = false;
}
markDone();
