// The Boardroom Problem — the script. Every interviewer line, choice, cost and
// score lives here. Figures are {{tokens}} filled by engine.fill() from the data,
// never typed. Feedback may be a function of what the candidate has found.

export const SETUP = {
  title: 'The Boardroom Problem',
  when: 'Thursday 19 November, 08:40',
  brief: [
    'Same company as The Revenue Problem, four weeks later. Your redesign shipped: Gross Order Value (Product) and Recognized Revenue (Finance) now have names, owners and a bridge.',
    'At 09:00 you present the revenue dashboard to the leadership team. The board pack goes out at noon.',
    'Your access: Viewer on the production dashboard (you cannot edit its queries), Editor in the analytics sandbox (an uncertified copy, refreshed nightly). The data engineer on call is reachable on chat. Production is in a deploy freeze until 10:00 for the review.',
  ],
  rules: [
    'The interviewer asks one question at a time. Each choice is scored on five dimensions; you see the scores at the end.',
    'Between 08:40 and 09:00 every look and every message costs game minutes. At 09:00 you are in the room, ready or not.',
    'Optional: type what you would say out loud. It is never graded by a machine; at the end you see it beside a model answer.',
  ],
};

export const FINDINGS = {
  spikes: 'Daily trend: spikes on 12 and 14 Nov, and a step up from about 10 Nov.',
  synthetic: '{{loadtest}} came from load-test accounts, all on 12 Nov: a load test ran against production.',
  replay: '{{replay}} is tagged source = replay: every event of 14 Nov was ingested twice.',
  dup: 'Since 10 Nov, control logs {{epo_control}} purchase events per order and checkout_v2 treatment logs {{epo_treatment}}: the new confirmation page re-fires order_completed ({{dup_bug}} of duplicates).',
  pricing: 'pricing_t arm B averages {{aov_B}} an order against {{aov_A}} in arm A: the 10% discount working as designed. Real customers, real money — an effect, not a leak.',
  readout: 'The experiment platform reads checkout_v2 from events: treatment {{checkout_raw}} on GOV.',
};
export const LEAK_FINDINGS = ['dup', 'synthetic', 'replay'];

// The interviewer's first question, before the clock starts.
export const OPENING = {
  id: 'opening',
  speaker: 'Interviewer',
  prompt: 'It is 08:40. Overnight the Gross Order Value tile moved to {{prod_last}} for the last two weeks — {{prod_lift}} on the two weeks before. The experiment dashboard shows checkout_v2 winning by {{checkout_raw}}, and Product plans to roll it out to everyone at 11:00. Both tiles say “3 of 3 checks passed”. Leadership is in twenty minutes. What is your first move?',
  choices: [
    { id: 'investigate', label: 'Look before I speak: break the number down', scores: { diagnosis: 1, process: 1 },
      feedback: 'Good. Twenty minutes buys evidence, not certainty. Spend it on the questions that change what goes on the screen.' },
    { id: 'edit', label: 'Fix the dashboard query so the number is right', scores: { process: -1 },
      feedback: 'The Edit button is grey: you are a Viewer in production. And if it weren’t — an unreviewed production change twenty minutes before an executive review would be the second incident of the morning. What can you do instead?' },
    { id: 'postpone', label: 'Ask to move the meeting', scores: {},
      feedback: 'The chief of staff replies: “Board pack goes at noon. You have the slot.” Asking was legitimate; the answer is no. Now what?' },
    { id: 'present', label: 'The checks passed — present it as it is', scores: { judgement: -1, communication: -1 },
      feedback: 'Interesting. The tile is green. Is the number true? A {{prod_lift}} jump in two weeks is a question before it is a headline — and “checks passed” only means the checks you wrote passed.' },
  ],
};

// What can be done between 08:40 and 09:00. `needs: 'sandbox'` means it only
// exists in the analytics sandbox.
export const LENSES = [
  { id: 'trend', label: 'Daily trend', cost: 1, reveals: 'spikes', view: 'trend' },
  { id: 'readout', label: 'Experiment platform: checkout_v2 readout', cost: 1, reveals: 'readout', view: 'readout' },
  { id: 'by_account', label: 'Split by account type', cost: 2, needs: 'sandbox', reveals: 'synthetic', view: 'account' },
  { id: 'by_source', label: 'Split by pipeline source', cost: 2, needs: 'sandbox', reveals: 'replay', view: 'source' },
  { id: 'epo', label: 'Purchase events per order, by checkout arm', cost: 2, needs: 'sandbox', reveals: 'dup', view: 'epo' },
  { id: 'pricing', label: 'Average order by pricing arm', cost: 2, needs: 'sandbox', reveals: 'pricing', view: 'pricing' },
];
export const FINDING_SCORES = { synthetic: { diagnosis: 1 }, replay: { diagnosis: 1 }, dup: { diagnosis: 1 },
  readout: { diagnosis: 1 }, pricing: { judgement: 1 }, spikes: {} };

export const ACTIONS = [
  { id: 'open_sandbox', label: 'Open the analytics sandbox', cost: 3, scores: { process: 1 },
    result: 'Sandbox open. Every view here carries a watermark: UNCERTIFIED · data to 18 Nov 23:00 · filters applied by you.' },
  { id: 'try_edit', label: 'Edit the production query', cost: 0, scores: {},
    result: 'Permission denied — Viewer role. Editing queries in production requires an Editor, and a reviewed change.' },
  { id: 'ask_changed', label: 'Message the data engineer: “Anything change in the GOV pipeline since 10 Nov?”', cost: 2,
    scores: { process: 1 }, replyAfter: 6, grants: 'replay',
    reply: 'Data engineer: “Morning. Known one — the 14 Nov backfill replayed the whole day; we dedupe after the freeze lifts at 10:00. Didn’t know about anything else. Shout if you need a view.”' },
  { id: 'ask_hotfix', label: 'Ask the data engineer to hotfix the production query now', cost: 2, scores: { process: -1 },
    reply: 'Data engineer: “We’re in a deploy freeze for your review — I can’t push to production without a second reviewer, and I wouldn’t at 08:50. I can set you up a sandbox view with the filters.”' },
  { id: 'annotate', label: 'Add a comment on the production dashboard', cost: 2, scores: { communication: 1, followthrough: 1 },
    result: 'Comment pinned to the GOV tile (Viewers may comment): “Under investigation — 12 and 14 Nov include test and duplicated data; figures being reconciled. Owner: you, by 11:00.”' },
];

export const FILTERS = [
  { id: 'dedupe', label: 'Count each order once (dedupe on order id)', evidence: 'dup' },
  { id: 'excludeSynthetic', label: 'Exclude load-test and internal accounts', evidence: 'synthetic' },
  { id: 'excludeReplay', label: 'Exclude replayed events', evidence: 'replay' },
  { id: 'excludeExperiments', label: 'Exclude all A/B-test traffic', evidence: null },
];

// Scored at 09:00 from the filters in force: a filter counts only with evidence;
// excluding every experiment removes real customers.
export function filterJudgement(state) {
  let s = 0;
  const notes = [];
  for (const f of FILTERS) {
    if (!state.filters[f.id]) continue;
    if (f.id === 'excludeExperiments') { s -= 2; notes.push('Excluded all experiment traffic: {{no_experiments_drop}} of real revenue removed.'); continue; }
    if (state.findings.has(f.evidence)) s += 1;
    else notes.push(`Applied “${f.label}” without evidence that it was needed.`);
  }
  return { score: s, notes };
}

const enough = (state) => LEAK_FINDINGS.filter((f) => state.findings.has(f)).length >= 2;

export const MEETING = {
  id: 'meeting',
  speaker: 'CEO',
  prompt: '09:00. “Okay — what are we looking at?”',
  choices: [
    { id: 'prod_caveat', label: 'The production dashboard as it is, and I’ll talk through the caveats', scores: { judgement: -1 },
      feedback: 'The room will remember the number on the screen, not the caveat said over it. {{prod_lift}} is now in three people’s notes.' },
    { id: 'side_by_side', label: 'Production and sandbox side by side: the official figure, what I removed and why, labelled uncertified',
      scores: (s) => (enough(s) && s.sandboxOpen ? { communication: 2, process: 1 } : {}),
      feedback: (s) => (enough(s) && s.sandboxOpen
        ? 'Strong. The official number stays visible, the cleaned one is labelled for what it is, and every dollar removed has a reason: {{leaks_total}} of leaks between {{prod_last}} and {{clean_last}}.'
        : 'You are showing a filtered number for problems you have not confirmed. In the room, “I filtered some things” is weaker than “I don’t know yet, here is what I do know”.') },
    { id: 'sandbox_only', label: 'The cleaned sandbox number, as the real number', scores: { communication: -1, process: -1 },
      feedback: 'It may be closer to the truth — and it is uncertified, a day old and filtered by you twenty minutes ago. Presenting it as the number swaps one unverified figure for another.' },
    { id: 'certified_plus', label: 'Finance’s certified figures for closed periods; November shown as under investigation, with what I know so far',
      scores: { communication: 1, process: 1 },
      feedback: 'Conservative and defensible: nothing on the screen is wrong. You give up some of the November story — make sure you still say what you found.' },
    { id: 'no_experiments', label: 'Exclude all A/B-test traffic, to be safe', scores: { judgement: -2 },
      feedback: 'That removes {{no_experiments_drop}} of real revenue. Experiments are customers paying real money; the defect is a logging bug in one arm, not experimentation.' },
  ],
};

export const CPO = {
  id: 'cpo',
  speaker: 'Chief Product Officer',
  prompt: '“So did checkout_v2 win? We roll it out to everyone at 11:00.”',
  choices: [
    { id: 'yes', label: 'Yes — {{checkout_raw}} on GOV', scores: { judgement: -2, communication: -1 },
      feedback: 'The win is the logging bug. Treatment fires more purchase events per order than control; count orders, not events, and it is {{checkout_clean}}.' },
    { id: 'hold', label: 'Hold the rollout: treatment double-logs purchases; counted per order it is {{checkout_clean}}. Re-read after the logging fix',
      scores: (s) => (s.findings.has('dup') ? { judgement: 2, communication: 1 } : {}),
      feedback: (s) => (s.findings.has('dup')
        ? 'Exactly the answer the room needed: a decision (hold), a reason with evidence ({{epo_treatment}} events per order against {{epo_control}}), and the next step.'
        : 'Right instinct, but you are asserting a cause you did not check. Say what you saw, and what you have not verified.') },
    { id: 'unknown', label: 'I can’t confirm it yet. I’d hold the rollout until I can, by end of day',
      scores: (s) => (s.findings.has('dup') ? { communication: 0, judgement: 1 } : { communication: 1, judgement: 1 }),
      feedback: (s) => (s.findings.has('dup')
        ? 'Safe, but you had the evidence: treatment logs {{epo_treatment}} purchase events per order. Use it.'
        : 'Honest and useful: you asked for the one decision that protects the company while you find out.') },
    { id: 'kill', label: 'Stop the experiment — the data is unreliable', scores: { judgement: -1 },
      feedback: 'The experiment is not broken; its logging is. Stopping it throws away two weeks of exposure to fix a bug you could fix in the event.' },
  ],
};

export const CFO = {
  id: 'cfo',
  speaker: 'Chief Financial Officer',
  prompt: '“And what goes in the board pack at noon?”',
  choices: [
    { id: 'average', label: 'Split the difference between the dashboard and the cleaned number', scores: { judgement: -2, communication: -1 },
      feedback: 'We have been here before. A midpoint is not a metric; nobody could say how it was computed.' },
    { id: 'certified', label: 'Certified Recognized Revenue for October; November GOV marked preliminary, with the known issues listed and the owner’s sign-off by 11:00',
      scores: { communication: 2, followthrough: 1 },
      feedback: 'Strong. Certified where it can be, labelled where it cannot, with an owner and a time. The board learns something true either way.' },
    { id: 'sandbox', label: 'The cleaned sandbox GOV', scores: { process: -1 },
      feedback: 'A board pack built from an uncertified sandbox you filtered this morning. If it is right, it is right by luck; if it is wrong, it is yours.' },
    { id: 'production', label: 'The production GOV — it is the official dashboard', scores: { judgement: -1 },
      feedback: 'Official is not the same as correct. You know {{leaks_total}} of it is test and duplicated data.' },
  ],
};

export const AFTER = {
  id: 'after',
  speaker: 'Interviewer',
  prompt: 'The meeting is over. What do you set in motion today? Choose all that apply.',
  multi: true,
  choices: [
    { id: 'incident', label: 'File a data incident: timeline (10, 12, 14 Nov), impact, owners', scores: { followthrough: 1 } },
    { id: 'checks', label: 'Ask the metric owner for certified checks: one row per order id, synthetic accounts excluded, replay detection', scores: { followthrough: 1 } },
    { id: 'guardrail', label: 'Add an events-per-order guardrail to the experimentation platform', scores: { followthrough: 1 } },
    { id: 'reread', label: 'Re-read checkout_v2 on deduplicated orders after the logging fix', scores: { followthrough: 1 } },
    { id: 'loadtest', label: 'Agree that load tests use tagged synthetic accounts, kept out of the analytics path', scores: { followthrough: 1 } },
    { id: 'screenshots', label: 'Email leadership screenshots of my sandbox view as the corrected numbers', scores: { process: -1 },
      feedback: 'Screenshots of an uncertified view become the numbers people quote for a year. Route corrections through the owner.' },
    { id: 'delete_days', label: 'Ask data engineering to delete 12 and 14 Nov from the dashboard', scores: { judgement: -1 },
      feedback: 'Deleting days hides the incident. Fix the data and keep the history, with an annotation.' },
  ],
};

export const ROUNDS = [MEETING, CPO, CFO, AFTER];

// The debrief: what was being tested, and model answers for "say it out loud".
export const MODEL_ANSWERS = {
  opening: '“Before I present anything, I want ten minutes to see where a {{prod_lift}} jump came from. I can’t change production, so I’ll look in the sandbox and ask the data engineer what changed.”',
  meeting: '“The official dashboard shows {{prod_last}}. I found three problems in it this morning — duplicate purchase events from the checkout test, a load test on the 12th and a replayed day on the 14th — together {{leaks_total}}. With those removed, in an uncertified sandbox, it is {{clean_last}}, {{clean_lift}} on the prior two weeks. Data engineering owns the fix; sign-off by 11:00.”',
  cpo: '“Hold the 11:00 rollout. Treatment logs about {{epo_treatment}} purchase events per order against {{epo_control}} in control; counted per order, the difference is {{checkout_clean}}. Fix the event, then re-read.”',
  cfo: '“October is closed and certified — use Recognized Revenue. November GOV goes in as preliminary, with the three known issues listed and the owner’s sign-off by 11:00.”',
};

export const TESTED = [
  ['Sequence under pressure', 'Did you look before you spoke, and spend the twenty minutes on the questions that change what goes on the screen?'],
  ['Permissions are a design constraint', 'Viewer in production, Editor in a sandbox, a deploy freeze: did you work within them instead of around them — and use the environment you do have, labelled?'],
  ['Defect versus effect', 'Duplicate events, a load test and a replay are defects. A pricing discount is an effect. Excluding “all experiment traffic” removes real customers.'],
  ['Honesty that is still useful', '“I don’t know yet” plus a decision that protects the company beats a confident number. A side-by-side with labels beats both.'],
  ['Turning a bad morning into a system', 'Incident, certified checks, an experiment guardrail, a re-read, a load-test policy: tomorrow’s dashboard should not need you at 08:40.'],
];
