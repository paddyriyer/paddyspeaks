// node interview.app/design/boardroom/tests/check.mjs
// 1. The engine reproduces every figure gen.py computed (same rows, two languages).
// 2. Every line of the script fills its {{tokens}} — no typo can ship.
// 3. The scoring behaves: the strong path scores high, the careless path low,
//    and the rules (permissions, evidence, the clock) hold.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../engine.js';
import * as S from '../scenario.js';
import * as G from '../game.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const json = JSON.parse(fs.readFileSync(path.join(here, '..', 'data.json'), 'utf8'));
const D = E.load(json);
const F = E.figures(D);
let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.error('✗', msg); } };

// 1 ── figures
for (const [k, v] of Object.entries(json.expected)) ok(F[k] === v, `figure ${k}: engine ${F[k]} vs gen.py ${v}`);
ok(F.unexplained === 0, 'leaks reconcile production to the cleaned number exactly');
ok(F.checkout_lift_raw_pct > 5 && F.checkout_lift_clean_pct < 1, 'the checkout "win" is the duplicate events');
ok(F.aov_pricing_B < F.aov_pricing_A, 'the pricing discount is real and kept');

// 2 ── every string fills
const has = (all) => ({ findings: new Set(all ? ['dup', 'synthetic', 'replay', 'pricing', 'readout', 'spikes'] : []), sandboxOpen: all });
const strings = [S.OPENING.prompt, ...Object.values(S.FINDINGS), ...Object.values(S.MODEL_ANSWERS),
  ...S.ACTIONS.flatMap((a) => [a.label, a.result, a.reply]), ...S.LENSES.map((l) => l.label)];
for (const round of [S.OPENING, ...S.ROUNDS]) {
  strings.push(round.prompt);
  for (const c of round.choices) {
    strings.push(c.label);
    for (const st of [has(true), has(false)]) {
      strings.push(typeof c.feedback === 'function' ? c.feedback(st) : c.feedback);
      const sc = typeof c.scores === 'function' ? c.scores(st) : c.scores;
      for (const k of Object.keys(sc || {})) ok(E.DIMENSIONS.some(([d]) => d === k), `${round.id}/${c.id}: unknown dimension ${k}`);
    }
  }
}
for (const s of strings.filter(Boolean)) {
  try { E.fill(s, F); } catch (e) { ok(false, `${e.message} in: ${s.slice(0, 60)}`); }
}
ok(S.FINDINGS.dup && S.LENSES.every((l) => l.reveals in S.FINDINGS), 'every lens reveals a known finding');

// 3 ── paths
function play(script) {
  const st = E.newState();
  G.choose(st, S.OPENING, script.opening);
  for (const step of script.steps) {
    const [kind, id] = step;
    if (kind === 'act') G.act(st, id);
    if (kind === 'lens') G.useLens(st, id);
    if (kind === 'filter') G.toggleFilter(st, id);
    G.collectReplies(st);
  }
  G.enterMeeting(st);
  G.choose(st, S.MEETING, script.meeting);
  G.choose(st, S.CPO, script.cpo);
  G.choose(st, S.CFO, script.cfo);
  G.chooseMany(st, S.AFTER, script.after);
  return { st, result: E.finalScores(st) };
}

const strong = play({
  opening: 'investigate',
  steps: [['act', 'ask_changed'], ['lens', 'trend'], ['act', 'open_sandbox'], ['lens', 'epo'], ['lens', 'by_account'],
    ['lens', 'pricing'], ['lens', 'readout'], ['filter', 'dedupe'], ['filter', 'excludeSynthetic'], ['filter', 'excludeReplay'],
    ['act', 'annotate']],
  meeting: 'side_by_side', cpo: 'hold', cfo: 'certified',
  after: ['incident', 'checks', 'guardrail', 'reread', 'loadtest'],
});
ok(strong.st.minute <= E.CLOCK.meeting, 'strong path fits in twenty minutes');
ok(strong.st.findings.has('replay'), 'the data engineer’s reply grants the replay finding');
ok(['dup', 'synthetic', 'replay'].every((f) => strong.st.findings.has(f)), 'strong path finds all three leaks');
ok(strong.result.band === 'Strong hire signal', `strong path band: ${strong.result.band} (${strong.result.total})`);

const careless = play({
  opening: 'present', steps: [['act', 'try_edit'], ['act', 'ask_hotfix']],
  meeting: 'prod_caveat', cpo: 'yes', cfo: 'average', after: ['screenshots', 'delete_days'],
});
ok(careless.result.band === 'Not yet', `careless path band: ${careless.result.band} (${careless.result.total})`);

const trap = play({
  opening: 'investigate', steps: [['act', 'open_sandbox'], ['filter', 'excludeExperiments']],
  meeting: 'no_experiments', cpo: 'kill', cfo: 'sandbox', after: [],
});
ok((trap.st.scores.judgement || 0) <= -4, 'excluding all experiments is punished twice');

// rules
const st = E.newState();
ok(G.useLens(st, 'epo').blocked, 'sandbox lenses need the sandbox');
ok(G.toggleFilter(st, 'dedupe').blocked, 'production has no filters');
for (let i = 0; i < 30; i++) G.useLens(st, 'trend');
ok(st.minute === E.CLOCK.meeting && G.useLens(st, 'trend').blocked, 'the clock stops at 09:00');

console.log(failed ? `${failed} check(s) failed` : `boardroom: all checks passed (${Object.keys(json.expected).length} figures, ${strings.length} strings, strong ${strong.result.total}/25, careless ${careless.result.total}/25)`);
process.exit(failed ? 1 : 0);
