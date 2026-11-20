// The Boardroom Problem — game rules. State transitions only; the page renders,
// tests/check.mjs drives the same functions without a browser.
import { addScore, spend, timeLeft } from './engine.js';
import { OPENING, LENSES, ACTIONS, FILTERS, FINDING_SCORES, ROUNDS, filterJudgement } from './scenario.js';

const resolve = (x, state) => (typeof x === 'function' ? x(state) : x);

export function choose(state, round, choiceId) {
  const c = round.choices.find((x) => x.id === choiceId);
  if (!c) throw new Error(`no choice ${choiceId} in ${round.id}`);
  addScore(state, resolve(c.scores, state));
  state.choices[round.id] = round.multi ? [...(state.choices[round.id] || []), choiceId] : choiceId;
  state.log.push({ at: state.minute, kind: 'choice', round: round.id, id: choiceId });
  return resolve(c.feedback, state) || '';
}

export function chooseMany(state, round, ids) {
  return ids.map((id) => choose(state, round, id)).filter(Boolean);
}

function reveal(state, finding) {
  if (!finding || state.findings.has(finding)) return false;
  state.findings.add(finding);
  addScore(state, FINDING_SCORES[finding]);
  return true;
}

export function available(state, item) {
  return !item.needs || (item.needs === 'sandbox' && state.sandboxOpen);
}

export function useLens(state, lensId) {
  const lens = LENSES.find((l) => l.id === lensId);
  if (!available(state, lens)) return { blocked: 'Open the analytics sandbox first.' };
  if (timeLeft(state) <= 0) return { blocked: 'It is 09:00. They are waiting.' };
  const ended = spend(state, lens.cost);
  const isNew = reveal(state, lens.reveals);
  state.log.push({ at: state.minute, kind: 'lens', id: lensId });
  return { view: lens.view, finding: lens.reveals, isNew, ended };
}

export function act(state, actionId) {
  const a = ACTIONS.find((x) => x.id === actionId);
  if (timeLeft(state) <= 0) return { blocked: 'It is 09:00. They are waiting.' };
  if (state.log.some((e) => e.kind === 'action' && e.id === actionId) && actionId !== 'try_edit') {
    return { blocked: 'Already done.' };
  }
  const ended = spend(state, a.cost);
  addScore(state, a.scores);
  if (actionId === 'open_sandbox') { state.sandboxOpen = true; state.env = 'sandbox'; }
  if (a.replyAfter) state.pendingReply = { at: state.minute + a.replyAfter, msg: a.reply, grants: a.grants };
  else if (a.reply) state.messages.push(a.reply);
  state.log.push({ at: state.minute, kind: 'action', id: actionId });
  return { result: a.result, reply: a.replyAfter ? null : a.reply, ended };
}

// A reply that arrives while the clock runs may carry evidence (the data engineer
// confirming the replay). Called by the page after every spend.
export function collectReplies(state) {
  const arrived = [];
  if (state.pendingReply && state.minute >= state.pendingReply.at) {
    state.messages.push(state.pendingReply.msg);
    reveal(state, state.pendingReply.grants);
    arrived.push(state.pendingReply.msg);
    state.pendingReply = null;
  }
  return arrived;
}

export function toggleFilter(state, filterId) {
  if (!state.sandboxOpen) return { blocked: 'Filters exist only in the sandbox; production is fixed.' };
  if (!FILTERS.some((f) => f.id === filterId)) throw new Error(filterId);
  if (timeLeft(state) <= 0) return { blocked: 'It is 09:00. They are waiting.' };
  state.filters[filterId] = !state.filters[filterId];
  const ended = spend(state, 1);
  state.log.push({ at: state.minute, kind: 'filter', id: filterId, on: state.filters[filterId] });
  return { on: state.filters[filterId], ended };
}

export function setEnv(state, env) {
  if (env === 'sandbox' && !state.sandboxOpen) return { blocked: 'Open the analytics sandbox first.' };
  state.env = env;
  return {};
}

// 09:00, ready or not: score the filters in force, once.
export function enterMeeting(state) {
  if (state.inMeeting) return state.meetingNotes;
  state.inMeeting = true;
  const fj = filterJudgement(state);
  addScore(state, { judgement: fj.score });
  state.meetingNotes = fj.notes;
  return fj.notes;
}

export function hesitate(state) {
  state.hesitations += 1;
  addScore(state, { communication: -1 });
}

export { OPENING, ROUNDS };
