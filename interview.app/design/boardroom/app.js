// The Boardroom Problem — the page. Renders state; every rule lives in game.js,
// every figure in engine.js, every line of the script in scenario.js.
import * as E from './engine.js';
import * as S from './scenario.js';
import * as G from './game.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let D, F, st, view = null, pressure = false, timer = null;
const fill = (t) => E.fill(t, F);

// ---------------------------------------------------------------- setup
async function init() {
  D = E.load(await (await fetch('data.json')).json());
  F = E.figures(D);
  $('setup-when').textContent = S.SETUP.when;
  $('setup-brief').innerHTML = S.SETUP.brief.map((b) => `<li>${esc(b)}</li>`).join('');
  $('setup-rules').innerHTML = S.SETUP.rules.map((b) => `<li>${esc(b)}</li>`).join('');
  $('start').addEventListener('click', start);
}

function start() {
  st = E.newState();
  view = null;
  pressure = $('pressure').checked;
  $('setup').hidden = true;
  $('debrief').hidden = true;
  $('stage').hidden = false;
  $('transcript').innerHTML = '';
  say('sys', '', 'Interview started. ' + S.SETUP.when + '.');
  renderWorkspace(false);
  ask(S.OPENING, () => {
    say('iv', 'Interviewer', 'The clock is running. Every look and every message costs minutes. At 09:00 you are in the room, ready or not. When you are ready earlier, say so.');
    explore();
  });
}

// ---------------------------------------------------------------- transcript
function say(kind, who, text) {
  const div = document.createElement('div');
  div.className = 'br-line ' + kind;
  div.innerHTML = (who ? `<b>${esc(who)}</b>` : '') + esc(text);
  $('transcript').appendChild(div);
  $('transcript').scrollTop = $('transcript').scrollHeight;
}

// ---------------------------------------------------------------- questions
function ask(round, then) {
  const q = $('question');
  const prompt = fill(round.prompt);
  say('iv', round.speaker, prompt);
  const note = `<div class="br-say"><label for="say-${round.id}">Say it out loud (optional, never graded by a machine)</label><textarea id="say-${round.id}"></textarea></div>`;
  if (round.multi) {
    q.innerHTML = `<h3 id="q-h" tabindex="-1">${esc(round.speaker)}</h3><p class="prompt">${esc(prompt)}</p>
      <fieldset style="border:0;padding:0;margin:0"><legend class="br-sr">Choose all that apply</legend><div class="br-choices">${round.choices.map((c) =>
        `<label class="br-choice-multi"><input type="checkbox" value="${c.id}"> <span>${esc(fill(c.label))}</span></label>`).join('')}</div></fieldset>
      ${note}<button class="br-btn" id="q-done" type="button">Done</button>`;
    $('q-done').addEventListener('click', () => {
      stopTimer();
      const ids = [...q.querySelectorAll('input:checked')].map((i) => i.value);
      st.notes[round.id] = $(`say-${round.id}`).value.trim();
      say('you', 'You', ids.length ? ids.map((id) => fill(round.choices.find((c) => c.id === id).label)).join(' · ') : 'Nothing.');
      G.chooseMany(st, round, ids).forEach((fb) => say('fb', 'Interviewer', fill(fb)));
      q.innerHTML = '';
      then();
    });
  } else {
    q.innerHTML = `<h3 id="q-h" tabindex="-1">${esc(round.speaker)}</h3><p class="prompt">${esc(prompt)}</p>
      <div class="br-timer" id="q-timer" aria-live="off"></div>
      <div class="br-choices">${round.choices.map((c) => `<button type="button" class="br-choice" data-id="${c.id}">${esc(fill(c.label))}</button>`).join('')}</div>${note}`;
    q.querySelectorAll('.br-choice').forEach((b) => b.addEventListener('click', () => {
      stopTimer();
      st.notes[round.id] = $(`say-${round.id}`).value.trim();
      const c = round.choices.find((x) => x.id === b.dataset.id);
      say('you', 'You', fill(c.label));
      const fb = G.choose(st, round, c.id);
      if (fb) say('fb', 'Interviewer', fill(fb));
      q.innerHTML = '';
      then();
    }));
  }
  $('q-h').focus();
  if (pressure && round.id !== 'opening' && !round.multi) startTimer();
}

function startTimer() {
  let left = 45;
  const t = $('q-timer');
  const tick = () => {
    if (!t.isConnected) return stopTimer();
    t.textContent = left > 0 ? `Pressure mode: ${left} s` : 'The room is waiting.';
    if (left === 10) t.setAttribute('aria-live', 'polite');
    if (left === 0) { G.hesitate(st); say('sys', '', 'Silence in the room. (Pressure mode: counted as hesitation.)'); stopTimer(); }
    left -= 1;
  };
  tick();
  timer = setInterval(tick, 1000);
}
function stopTimer() { if (timer) clearInterval(timer); timer = null; }

// ---------------------------------------------------------------- exploration
function explore() {
  $('question').innerHTML = `<h3 id="q-h" tabindex="-1">08:40 – 09:00</h3><p class="prompt">Use “Your screen” to look, ask and filter. Each step costs game minutes.</p>
    <button class="br-btn" id="ready" type="button">I’m ready — start the meeting</button>`;
  $('ready').addEventListener('click', meeting);
  renderWorkspace(true);
}

function after(result) {
  for (const msg of G.collectReplies(st)) say('sys', 'Chat', msg);
  if (result && result.blocked) say('sys', '', result.blocked);
  renderWorkspace(true);
  if (E.timeLeft(st) <= 0) {
    say('iv', 'Interviewer', 'It is 09:00. They are walking in.');
    meeting();
  }
}

function meeting() {
  if (st.inMeeting) return;
  G.enterMeeting(st);
  renderWorkspace(false);
  say('sys', '', `09:00 — meeting. Your screen shows the ${envName(st.env)}.`);
  const [m, cpo, cfo, aft] = S.ROUNDS;
  ask(m, () => ask(cpo, () => ask(cfo, () => ask(aft, debrief))));
}

// ---------------------------------------------------------------- workspace
const envName = (e) => ({ production: 'production dashboard', sandbox: 'analytics sandbox', finance: 'Finance certified view' }[e]);
const filtersFor = (env) => (env === 'production' ? E.PRODUCTION : st.filters);

function renderWorkspace(live) {
  const used = st.minute - E.CLOCK.start, left = E.timeLeft(st);
  $('clock').textContent = E.clock(st.minute);
  $('clock-left').textContent = st.inMeeting ? 'In the meeting' : `${left} minute${left === 1 ? '' : 's'} to the meeting`;
  $('bar').setAttribute('aria-valuenow', String(used));
  $('bar-fill').style.width = `${(100 * used) / 20}%`;

  const tabs = [['production', 'Production · Viewer'], ['sandbox', 'Analytics sandbox · Editor'], ['finance', 'Finance · certified']];
  $('tabs').innerHTML = tabs.map(([id, label]) => `<button type="button" class="br-tab" data-env="${id}" aria-pressed="${st.env === id}" ${(!live || (id === 'sandbox' && !st.sandboxOpen)) ? 'disabled' : ''}>${label}</button>`).join('');
  $('tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { G.setEnv(st, b.dataset.env); renderWorkspace(true); }));

  renderTile();
  renderView();

  $('lenses').innerHTML = S.LENSES.map((l) => {
    const ok = live && G.available(st, l);
    return `<button type="button" class="br-act" data-lens="${l.id}" ${ok ? '' : 'disabled'}>${esc(l.label)}<span class="cost">${l.cost} min${l.needs ? ' · sandbox' : ''}</span></button>`;
  }).join('');
  $('lenses').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    const r = G.useLens(st, b.dataset.lens);
    if (!r.blocked) {
      view = r.view;
      if (r.isNew) say('sys', 'Notebook', fill(S.FINDINGS[r.finding]));
    }
    after(r);
  }));

  const done = (id) => st.log.some((e) => e.kind === 'action' && e.id === id);
  $('actions').innerHTML = S.ACTIONS.map((a) => {
    const ok = live && (a.id === 'try_edit' || !done(a.id)) && !(a.id === 'open_sandbox' && st.sandboxOpen);
    return `<button type="button" class="br-act" data-act="${a.id}" ${ok ? '' : 'disabled'}>${esc(a.label)}<span class="cost">${a.cost ? a.cost + ' min' : 'instant'}</span></button>`;
  }).join('');
  $('actions').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    const r = G.act(st, b.dataset.act);
    if (r.result) say('sys', '', r.result);
    if (r.reply) say('sys', 'Chat', r.reply);
    if (b.dataset.act === 'ask_changed' && !r.blocked) say('sys', '', 'Message sent. A reply usually takes a few minutes.');
    after(r);
  }));

  $('filters-wrap').hidden = !st.sandboxOpen;
  $('filters').innerHTML = S.FILTERS.map((f) => `<label><input type="checkbox" data-filter="${f.id}" ${st.filters[f.id] ? 'checked' : ''} ${live ? '' : 'disabled'}> ${esc(f.label)}</label>`).join('');
  $('filters').querySelectorAll('input').forEach((i) => i.addEventListener('change', () => {
    const r = G.toggleFilter(st, i.dataset.filter);
    if (!r.blocked) { st.env = 'sandbox'; say('sys', '', `Sandbox filter ${r.on ? 'on' : 'off'}: ${S.FILTERS.find((f) => f.id === i.dataset.filter).label}.`); }
    after(r);
  }));

  $('notebook').innerHTML = st.findings.size
    ? `<ul>${[...st.findings].map((f) => `<li>${esc(fill(S.FINDINGS[f]))}</li>`).join('')}</ul>`
    : '<p class="br-empty">Nothing yet. Evidence you find is kept here.</p>';
  $('chat').innerHTML = st.messages.length
    ? `<ul>${st.messages.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`
    : `<p class="br-empty">${st.pendingReply ? 'Waiting for the data engineer…' : 'No messages.'}</p>`;
}

function renderTile() {
  const w = D.windows.last;
  if (st.env === 'finance') {
    $('tile').innerHTML = `<div class="name">Recognized Revenue · October 2026</div>
      <div class="val">${E.money(D.finance.october_recognized_cents)}</div>
      <div class="sub">Closed and certified. November closes on ${esc(D.finance.november_close)}; there is no certified November figure yet.</div>
      <span class="wm cert">Certified · Finance</span>`;
    return;
  }
  const f = filtersFor(st.env);
  const on = S.FILTERS.filter((x) => f[x.id]).map((x) => x.label.toLowerCase());
  $('tile').innerHTML = `<div class="name">Gross Order Value · ${esc(w[0])} to ${esc(w[1])}</div>
    <div class="val">${E.money(E.total(D, f))}</div>
    <div class="sub">${E.signed(E.lift(D, f))}% on the two weeks before · ${st.env === 'production' ? 'sums every purchase event' : on.length ? 'filters: ' + esc(on.join('; ')) : 'no filters yet'}</div>
    ${st.env === 'production' ? '<span class="wm prod">Production · 3 of 3 checks passed</span>' : '<span class="wm uncert">Uncertified · sandbox · data to 18 Nov 23:00</span>'}`;
}

// ---------------------------------------------------------------- views
function renderView() {
  const v = $('view');
  if (st.env === 'finance') { v.innerHTML = '<p class="br-empty">The certified view has closed months only. It cannot tell you what happened in November.</p>'; return; }
  const f = filtersFor(st.env);
  const lens = S.LENSES.find((l) => l.view === view);
  if (!view) { v.innerHTML = '<p class="br-empty">Choose something to look at.</p>'; return; }
  if (lens && lens.needs === 'sandbox' && st.env !== 'sandbox') { v.innerHTML = '<p class="br-empty">That view exists only in the sandbox. Switch to the sandbox tab to see it again.</p>'; return; }
  if (view === 'trend') v.innerHTML = trend(f);
  if (view === 'account') v.innerHTML = split('account', 'GOV by account type, last two weeks', f);
  if (view === 'source') v.innerHTML = split('source', 'GOV by pipeline source, last two weeks', f);
  if (view === 'epo') v.innerHTML = `<h4>Purchase events per order, by checkout_v2 arm, since ${esc(D.dates.bug_start)}</h4>
      <div class="br-big"><div><b>${F.events_per_order_control.toFixed(2)}</b><span>control</span></div><div><b>${F.events_per_order_treatment.toFixed(2)}</b><span>treatment</span></div></div>
      <p class="br-empty" style="margin-top:8px">One order should produce one purchase event.</p>`;
  if (view === 'pricing') v.innerHTML = `<h4>Average order by pricing_t arm, last two weeks (counted per order)</h4>
      <div class="br-big"><div><b>$${F.aov_pricing_A.toFixed(2)}</b><span>arm A (list price)</span></div><div><b>$${F.aov_pricing_B.toFixed(2)}</b><span>arm B (10% discount)</span></div></div>`;
  if (view === 'readout') {
    const clean = st.env === 'sandbox' && st.filters.dedupe;
    v.innerHTML = `<h4>checkout_v2 · treatment vs control · GOV since ${esc(D.dates.checkout_start)}</h4>
      <div class="br-big"><div><b>${E.signed(F.checkout_lift_raw_pct)}%</b><span>experiment platform (counts purchase events)</span></div>
      ${clean ? `<div><b>${E.signed(F.checkout_lift_clean_pct)}%</b><span>sandbox, counted per order</span></div>` : ''}</div>
      <p class="br-empty" style="margin-top:8px">${clean ? '' : 'The sandbox can recount this per order once orders are deduplicated.'}</p>`;
  }
}

function trend(f) {
  const days = E.daily(D, f);
  const max = Math.max(...days.map((d) => d.cents));
  const W = 560, H = 170, bw = W / days.length;
  const bars = days.map((d, i) => {
    const h = Math.round((d.cents / max) * (H - 30));
    const mark = d.day === D.dates.loadtest_day || d.day === D.dates.replay_day;
    return `<rect x="${(i * bw + 1).toFixed(1)}" y="${H - 18 - h}" width="${(bw - 2).toFixed(1)}" height="${h}" fill="${mark ? 'var(--accent)' : 'var(--text-3)'}"/>`;
  }).join('');
  const label = (day, text) => {
    const i = days.findIndex((d) => d.day === day);
    return i < 0 ? '' : `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 4}" font-size="10" text-anchor="middle" fill="currentColor">${text}</text>`;
  };
  const rows = days.map((d) => `<tr><td>${d.day}</td><td class="num">${E.money(d.cents)}</td></tr>`).join('');
  return `<h4>Gross Order Value by day, ${esc(days[0].day)} to ${esc(days[days.length - 1].day)}</h4>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily GOV for 28 days. Highest day ${E.money(max)}. Highlighted bars: ${D.dates.loadtest_day} and ${D.dates.replay_day}." style="color:var(--text-2)">${bars}
    ${label(D.dates.loadtest_day, '12 Nov')}${label(D.dates.replay_day, '14 Nov')}${label(D.dates.bug_start, '10 Nov')}</svg>
    <details><summary>Show as a table</summary><table><thead><tr><th>Day</th><th class="num">GOV</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}

function split(dim, title, f) {
  const rows = E.breakdown(D, dim, f);
  const max = Math.max(...rows.map((r) => r.cents));
  return `<h4>${esc(title)}</h4><table><thead><tr><th>${dim === 'account' ? 'Account type' : 'Source'}</th><th class="num">GOV</th><th class="num">Share</th></tr></thead><tbody>${rows.map((r) =>
    `<tr><td>${esc(r.key)}</td><td class="num">${E.money(r.cents)}</td><td class="num">${Math.round((100 * r.cents) / rows.reduce((a, b) => a + b.cents, 0))}%</td></tr>`).join('')}</tbody></table>
    <p class="br-empty" style="margin-top:6px">${rows.length === 1 ? 'Only one value left with the current filters.' : `Largest: ${esc(rows[0].key)} (${E.money(max)}).`}</p>`;
}

// ---------------------------------------------------------------- debrief
function debrief() {
  stopTimer();
  const R = E.finalScores(st);
  const found = (f) => st.findings.has(f);
  const fj = (st.meetingNotes || []).map((n) => `<li>${esc(fill(n))}</li>`).join('');
  const dims = E.DIMENSIONS.map(([k, label, what]) => `<div class="br-dim"><div><strong>${esc(label)}</strong><small>${esc(what)}</small></div>
    <div class="meter" role="img" aria-label="${R.dims[k]} of 5"><span style="width:${R.dims[k] * 20}%"></span></div><div><strong>${R.dims[k]}</strong>/5</div></div>`).join('');
  const evidence = ['dup', 'synthetic', 'replay', 'pricing', 'readout'].map((f) =>
    `<li><strong>${found(f) ? 'Found' : 'Missed'}:</strong> ${esc(fill(S.FINDINGS[f]))}</li>`).join('');
  const timeline = st.log.map((e) => `<li><span style="font-family:var(--font-mono)">${E.clock(e.at)}</span> — ${esc(describe(e))}</li>`).join('');
  const compare = Object.entries(S.MODEL_ANSWERS).map(([id, model]) => `<div><b>You said (${esc(id)})</b>${esc(st.notes[id] || '— (nothing typed)')}</div><div><b>A strong answer</b>${esc(fill(model))}</div>`).join('');
  const d = $('debrief');
  d.innerHTML = `<div class="br-card">
    <div class="br-eyebrow">Debrief</div>
    <h2 id="debrief-h">How you thought on your feet</h2>
    <div class="br-score"><span class="n">${R.total}<span style="font-size:22px">/25</span></span><span class="band">${esc(R.band)}</span></div>
    ${dims}
    <h2 style="margin-top:24px">The evidence</h2><ul>${evidence}</ul>
    ${fj ? `<p><strong>Filters in force at 09:00:</strong></p><ul>${fj}</ul>` : ''}
    <p>With all three leaks removed the dashboard reads ${esc(E.money(F.clean_last))} (${esc(E.signed(F.clean_lift_pct))}% on the prior two weeks), against ${esc(E.money(F.prod_last))} in production: ${esc(E.money(F.dup_bug))} of duplicate events, ${esc(E.money(F.loadtest))} of load test and ${esc(E.money(F.replay))} of replay, with nothing left unexplained.</p>
    <h2 style="margin-top:24px">Your words and a strong answer</h2><div class="br-compare">${compare}</div>
    <h2>What the interviewer was testing</h2><ul>${S.TESTED.map(([t, x]) => `<li><strong>${esc(t)}.</strong> ${esc(x)}</li>`).join('')}</ul>
    <h2>Your timeline</h2><ul>${timeline}</ul>
    <p style="margin-top:18px"><button class="br-btn" id="again" type="button">Play again</button> <a class="br-btn ghost" href="../the-revenue-problem.html" style="display:inline-block;text-decoration:none">Read Nº 42, The Revenue Problem</a></p>
  </div>`;
  $('stage').hidden = true;
  d.hidden = false;
  d.focus();
  d.scrollIntoView({ block: 'start' });
  $('again').addEventListener('click', () => { $('debrief').hidden = true; $('setup').hidden = false; $('start').focus(); });
}

function describe(e) {
  if (e.kind === 'choice') {
    const round = [S.OPENING, ...S.ROUNDS].find((r) => r.id === e.round);
    return `${round.speaker}: ${fill(round.choices.find((c) => c.id === e.id).label)}`;
  }
  if (e.kind === 'lens') return 'Looked at: ' + S.LENSES.find((l) => l.id === e.id).label;
  if (e.kind === 'action') return S.ACTIONS.find((a) => a.id === e.id).label;
  if (e.kind === 'filter') return `Filter ${e.on ? 'on' : 'off'}: ${S.FILTERS.find((f) => f.id === e.id).label}`;
  return e.kind;
}

init();
