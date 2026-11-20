// The Boardroom Problem — engine. Pure functions over data.json: no DOM, so the
// page and tests/check.mjs run exactly the same code. All money is integer cents.

export const DIMENSIONS = [
  ['diagnosis', 'Diagnosis', 'Found what leaked into the number, with evidence'],
  ['judgement', 'Data judgement', 'Removed the defects and kept the real effects'],
  ['process', 'Access and process', 'Worked within permissions; no risky change before the meeting'],
  ['communication', 'Communication under pressure', 'Honest, specific, labelled — and still useful'],
  ['followthrough', 'Follow-through', 'Turned the morning into checks, owners and fixes'],
];

export const CLOCK = { start: 8 * 60 + 40, meeting: 9 * 60 };   // 08:40 → 09:00

export function load(json) {
  const cols = json.columns;
  const rows = json.rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  const inRange = (d, [a, b]) => d >= a && d <= b;
  return { ...json, rows, inLast: (d) => inRange(d, json.windows.last), inPrior: (d) => inRange(d, json.windows.prior) };
}

// Filters the sandbox exposes. Production has none of them: it sums every event.
export const PRODUCTION = Object.freeze({ dedupe: false, excludeSynthetic: false, excludeReplay: false, excludeExperiments: false });

export function keep(r, f) {
  if (f.excludeSynthetic && r.account !== 'customer') return false;
  if (f.excludeReplay && r.source === 'replay') return false;
  if (f.excludeExperiments && (r.checkout_arm !== 'none' || r.pricing_arm !== 'none')) return false;
  return true;
}
const value = (r, f) => (f.dedupe ? r.cents - r.dup_cents : r.cents);
const orders = (r, f) => (f.dedupe ? r.events - r.dup_events : r.events);

export function total(D, f, window = 'last') {
  const inW = window === 'last' ? D.inLast : D.inPrior;
  return D.rows.reduce((s, r) => (inW(r.day) && keep(r, f) ? s + value(r, f) : s), 0);
}

export function lift(D, f) {
  const a = total(D, f, 'last'), b = total(D, f, 'prior');
  return round1((100 * (a - b)) / b);
}

export function daily(D, f) {
  const by = new Map();
  for (const r of D.rows) if (keep(r, f)) by.set(r.day, (by.get(r.day) || 0) + value(r, f));
  return [...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, cents]) => ({ day, cents }));
}

export function breakdown(D, dim, f, window = 'last') {
  const inW = window === 'last' ? D.inLast : D.inPrior;
  const by = new Map();
  for (const r of D.rows) if (inW(r.day) && keep(r, f)) by.set(r[dim], (by.get(r[dim]) || 0) + value(r, f));
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([key, cents]) => ({ key, cents }));
}

// Events per distinct order, by checkout arm, since the bug shipped.
export function eventsPerOrder(D, arm) {
  let ev = 0, ord = 0;
  for (const r of D.rows) {
    if (r.day < D.dates.bug_start || r.account !== 'customer' || r.source !== 'live' || r.checkout_arm !== arm) continue;
    ev += r.events; ord += r.events - r.dup_events;
  }
  return round2(ev / ord);
}

// checkout_v2 readout: treatment vs control GOV since the test started.
export function checkoutLift(D, dedupe) {
  const f = { ...PRODUCTION, dedupe, excludeSynthetic: true, excludeReplay: true };
  const arm = (a) => D.rows.reduce((s, r) =>
    (r.day >= D.dates.checkout_start && keep(r, f) && r.checkout_arm === a ? s + value(r, f) : s), 0);
  return round1((100 * (arm('treatment') - arm('control'))) / arm('control'));
}

export function aov(D, pricingArm) {
  const f = { ...PRODUCTION, dedupe: true, excludeSynthetic: true, excludeReplay: true };
  let c = 0, n = 0;
  for (const r of D.rows) if (D.inLast(r.day) && keep(r, f) && r.pricing_arm === pricingArm) { c += value(r, f); n += orders(r, f); }
  return round2(c / n / 100);
}

// The leaks, measured in the last window: what each one added to production.
export function leaks(D) {
  let dup = 0, synth = 0, replay = 0;
  for (const r of D.rows) {
    if (!D.inLast(r.day)) continue;
    if (r.source === 'replay') replay += r.cents;
    else if (r.account !== 'customer') synth += r.cents;
    else dup += r.dup_cents;
  }
  return { dup, synth, replay };
}

// Every figure the script quotes, from one place.
export function figures(D) {
  const clean = { dedupe: true, excludeSynthetic: true, excludeReplay: true, excludeExperiments: false };
  const l = leaks(D);
  return {
    prod_last: total(D, PRODUCTION), prod_prior: total(D, PRODUCTION, 'prior'), prod_lift_pct: lift(D, PRODUCTION),
    clean_last: total(D, clean), clean_prior: total(D, clean, 'prior'), clean_lift_pct: lift(D, clean),
    dup_bug: l.dup, loadtest: l.synth, replay: l.replay,
    unexplained: total(D, PRODUCTION) - l.dup - l.synth - l.replay - total(D, clean),
    no_experiments_last: total(D, { ...clean, excludeExperiments: true }),
    events_per_order_control: eventsPerOrder(D, 'control'), events_per_order_treatment: eventsPerOrder(D, 'treatment'),
    checkout_lift_raw_pct: checkoutLift(D, false), checkout_lift_clean_pct: checkoutLift(D, true),
    aov_pricing_A: aov(D, 'A'), aov_pricing_B: aov(D, 'B'),
  };
}

export const money = (cents) => {
  const d = cents / 100;
  if (Math.abs(d) >= 1e6) return `$${(d / 1e6).toFixed(2)}M`;
  if (Math.abs(d) >= 1e3) return `$${Math.round(d / 1e3).toLocaleString('en-US')}K`;
  return `$${d.toFixed(2)}`;
};
export const signed = (x) => (x > 0 ? `+${x}` : `${x}`);
export const clock = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
function round1(x) { return Math.round(x * 10) / 10; }
function round2(x) { return Math.round(x * 100) / 100; }

// {{token}} → a formatted figure. Unknown tokens throw, so a typo cannot ship.
export function fill(text, F) {
  const fmt = {
    prod_last: money(F.prod_last), prod_prior: money(F.prod_prior), prod_lift: signed(F.prod_lift_pct) + '%',
    clean_last: money(F.clean_last), clean_lift: signed(F.clean_lift_pct) + '%',
    dup_bug: money(F.dup_bug), loadtest: money(F.loadtest), replay: money(F.replay),
    leaks_total: money(F.dup_bug + F.loadtest + F.replay), unexplained: money(F.unexplained),
    no_experiments: money(F.no_experiments_last),
    no_experiments_drop: Math.round((100 * (F.clean_last - F.no_experiments_last)) / F.clean_last) + '%',
    epo_control: F.events_per_order_control.toFixed(2), epo_treatment: F.events_per_order_treatment.toFixed(2),
    checkout_raw: signed(F.checkout_lift_raw_pct) + '%', checkout_clean: signed(F.checkout_lift_clean_pct) + '%',
    aov_A: '$' + F.aov_pricing_A.toFixed(2), aov_B: '$' + F.aov_pricing_B.toFixed(2),
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in fmt)) throw new Error(`unknown token {{${k}}}`);
    return fmt[k];
  });
}

// ---- game state ---------------------------------------------------------
export function newState() {
  return {
    minute: CLOCK.start, env: 'production', sandboxOpen: false,
    filters: { ...PRODUCTION }, findings: new Set(), log: [], scores: {},
    choices: {}, notes: {}, messages: [], pendingReply: null, hesitations: 0,
  };
}

export function addScore(state, deltas = {}) {
  for (const [k, v] of Object.entries(deltas)) state.scores[k] = (state.scores[k] || 0) + v;
}

export function spend(state, minutes) {
  state.minute = Math.min(CLOCK.meeting, state.minute + minutes);
  return state.minute >= CLOCK.meeting;
}

export const timeLeft = (state) => CLOCK.meeting - state.minute;

// Final scores: per dimension, clamped to 0..5, plus the band.
export function finalScores(state) {
  const out = {};
  for (const [k] of DIMENSIONS) out[k] = Math.max(0, Math.min(5, state.scores[k] || 0));
  const totalScore = Object.values(out).reduce((a, b) => a + b, 0);
  const band = totalScore >= 21 ? 'Strong hire signal' : totalScore >= 15 ? 'Hire signal, with gaps'
    : totalScore >= 9 ? 'Mixed — would need another round' : 'Not yet';
  return { dims: out, total: totalScore, band };
}
