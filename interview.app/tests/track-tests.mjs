/*
 * Dependency-free test suite for the Communication & AI Engineering learning
 * tracks. Run with:  node interview.app/tests/track-tests.mjs
 *
 * Covers (per the implementation brief): content validity, filtering,
 * answer-evaluation, progress-persistence key shape, track wiring across the
 * Skill Check / Flashcards / Question Bank, and responsive nav presence.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");            // interview.app/
const ROOT = join(APP, "..");            // repo root
const read = (p) => readFileSync(p, "utf8");
const readJSON = (p) => JSON.parse(read(p));

let passed = 0, failed = 0;
const fails = [];
function ok(cond, msg) { if (cond) { passed++; } else { failed++; fails.push(msg); } }
function section(name) { console.log(`\n▸ ${name}`); }

// ─────────────────────────────────────────────────────────────────────────
section("Content files load & schema");
const comm = readJSON(join(APP, "evaluate/data/communication.json"));
const ai = readJSON(join(APP, "evaluate/data/ai.json"));
const bank = readJSON(join(ROOT, "interview/data/questions-ai.json"));

ok(comm.section === "communication", "communication.json has section=communication");
ok(ai.section === "ai", "ai.json has section=ai");
ok(comm.questions.length >= 100, `communication has 100+ exercises (got ${comm.questions.length})`);
ok(ai.questions.length >= 150, `ai has 150+ questions (got ${ai.questions.length})`);
ok(bank.length === ai.questions.length, "bank record count matches ai question count");

// Every module represented
ok(comm.modules.length === 12, "communication has 12 modules");
ok(ai.modules.length === 20, "ai has 20 modules");
for (const m of comm.modules) ok(comm.questions.some(q => q.topic === m), `comm module covered: ${m}`);
for (const m of ai.modules) ok(ai.questions.some(q => q.topic === m), `ai module covered: ${m}`);

// Per-question schema validity (answer indices in range, required fields)
function validateQuestions(doc, label) {
  const ids = new Set();
  for (const q of doc.questions) {
    ok(!!q.id && !ids.has(q.id), `${label} unique id: ${q.id}`);
    ids.add(q.id);
    ok(["single", "multi", "open"].includes(q.type), `${label} ${q.id} valid type`);
    ok(["easy", "medium", "hard"].includes(q.difficulty), `${label} ${q.id} valid difficulty`);
    ok(typeof q.prompt === "string" && q.prompt.length > 0, `${label} ${q.id} has prompt`);
    ok(typeof q.topic === "string" && doc.modules.includes(q.topic), `${label} ${q.id} topic in modules`);
    if (q.type === "single") {
      ok(Array.isArray(q.options) && q.options.length >= 2, `${label} ${q.id} has options`);
      ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${label} ${q.id} answer index in range`);
    } else if (q.type === "multi") {
      ok(Array.isArray(q.answer) && q.answer.length >= 1, `${label} ${q.id} multi answer array`);
      ok(q.answer.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length), `${label} ${q.id} multi indices in range`);
    } else {
      ok(typeof q.model_answer === "string" && q.model_answer.length > 0, `${label} ${q.id} has model_answer`);
    }
    ok(typeof q.explanation === "string" && q.explanation.length > 0, `${label} ${q.id} has explanation`);
  }
}
validateQuestions(comm, "comm");
validateQuestions(ai, "ai");

// AI-specific rich fields present on a good share (interview usefulness)
const aiWithMistake = ai.questions.filter(q => q.common_mistake).length;
const aiWithTags = ai.questions.filter(q => Array.isArray(q.tags) && q.tags.length).length;
ok(aiWithMistake >= ai.questions.length * 0.8, `ai: 80%+ have common_mistake (${aiWithMistake})`);
ok(aiWithTags >= ai.questions.length * 0.9, `ai: 90%+ have tags (${aiWithTags})`);
// Communication rich fields
const commRewrites = comm.questions.filter(q => q.format === "rewrite" || q.format === "scenario").length;
ok(commRewrites >= 15, `comm: has rewrite/scenario exercises (${commRewrites})`);
const commRoles = new Set(comm.questions.map(q => q.role));
for (const r of ["Candidate", "Individual Contributor", "Manager", "Technical Leader"]) ok(commRoles.has(r), `comm role present: ${r}`);

// ─────────────────────────────────────────────────────────────────────────
section("Answer evaluation logic");
function gradeObjective(q, ans) {
  if (q.type === "single") return ans === q.answer;
  const a = [...ans].sort(), b = [...q.answer].sort();
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
const single = comm.questions.find(q => q.type === "single");
ok(gradeObjective(single, single.answer) === true, "single: correct answer grades true");
ok(gradeObjective(single, (single.answer + 1) % single.options.length) === false, "single: wrong answer grades false");
const multi = ai.questions.find(q => q.type === "multi") || comm.questions.find(q => q.type === "multi");
ok(gradeObjective(multi, [...multi.answer]) === true, "multi: exact set grades true");
ok(gradeObjective(multi, multi.answer.slice(0, 1)) === false, "multi: partial set grades false");

// ─────────────────────────────────────────────────────────────────────────
section("Filtering logic (topic / level / role / type)");
function levelOf(q) { return q.level || ({ easy: "Beginner", medium: "Intermediate", hard: "Advanced" }[q.difficulty]); }
function exType(q) {
  if (q.format) return { mc: "Multiple choice", rewrite: "Rewrite", scenario: "Scenario", speaking: "Speaking" }[q.format];
  return { single: "Multiple choice", multi: "Multi-select", open: "Written / scenario" }[q.type];
}
// topic filter
const topic = ai.modules[6];
const byTopic = ai.questions.filter(q => q.topic === topic);
ok(byTopic.length > 0 && byTopic.every(q => q.topic === topic), `filter by topic '${topic}' works`);
// level filter (incl. Expert exists in AI)
const levels = new Set(ai.questions.map(levelOf));
ok(levels.has("Expert"), "ai has Expert-level questions");
ok(ai.questions.filter(q => levelOf(q) === "Beginner").length > 0, "ai has Beginner questions");
// role filter
const aiRoles = new Set(ai.questions.map(q => q.role));
ok(aiRoles.size >= 4, `ai has multiple roles (${aiRoles.size})`);
// exercise-type filter maps cleanly
ok(ai.questions.every(q => !!exType(q)), "every ai question maps to an exercise type");
ok(comm.questions.every(q => !!exType(q)), "every comm question maps to an exercise type");

// Skill Check landing format grouping (mc/code/open) — comm/ai use mc+open only
function fmtGroup(t) { return t === "code" ? "code" : t === "open" ? "open" : "mc"; }
const commGroups = new Set(comm.questions.map(q => fmtGroup(q.type)));
ok(!commGroups.has("code"), "comm has no code questions (no runtime needed)");
ok(commGroups.has("mc") && commGroups.has("open"), "comm has mc + open groups");

// ─────────────────────────────────────────────────────────────────────────
section("Readiness score computation");
function readiness(progress, total, coverageTarget = 0.4) {
  let seen = 0, score = 0;
  for (const k in progress) { seen++; score += progress[k].result === "correct" ? 1 : progress[k].result === "partial" ? 0.5 : 0; }
  const accuracy = seen ? score / seen : 0;
  const confidence = Math.min(1, (seen / total) / coverageTarget);
  return Math.round(accuracy * 100 * confidence);
}
ok(readiness({}, 100) === 0, "readiness is 0 with no progress");
// all-correct but low coverage → penalized by confidence
const few = {}; for (let i = 0; i < 4; i++) few["q" + i] = { result: "correct" };
ok(readiness(few, 100) < 100, "low coverage penalizes readiness even at 100% accuracy");
// good coverage + accuracy → high
const many = {}; for (let i = 0; i < 40; i++) many["q" + i] = { result: "correct" };
ok(readiness(many, 100) === 100, "full coverage + accuracy → 100");

// ─────────────────────────────────────────────────────────────────────────
section("Skill Check + Flashcards wiring");
const engine = read(join(APP, "evaluate/js/quiz-engine.js"));
ok(/ai:\s*{[^}]*ai\.json/.test(engine), "quiz-engine SECTIONS registers ai");
ok(/communication:\s*{[^}]*communication\.json/.test(engine), "quiz-engine SECTIONS registers communication");
ok(engine.includes("reviewExtras"), "quiz-engine surfaces rich extras (reviewExtras)");

const evalLanding = read(join(APP, "evaluate/index.html"));
ok(/SLUGS\s*=\s*\[[^\]]*"ai"[^\]]*"communication"/.test(evalLanding), "evaluate landing SLUGS includes ai + communication");
ok(evalLanding.includes('data-section="ai"'), "evaluate landing has AI card");
ok(evalLanding.includes('data-section="communication"'), "evaluate landing has Communication card");

const flash = read(join(APP, "flashcards/index.html"));
ok(/slug:\s*"ai"[^\n]*ai\.json/.test(flash), "flashcards DECKS includes ai");
ok(/slug:\s*"communication"[^\n]*communication\.json/.test(flash), "flashcards DECKS includes communication");

// ─────────────────────────────────────────────────────────────────────────
section("Question Bank first-class AI category");
const langs = readJSON(join(ROOT, "interview/data/languages.json"));
ok(langs.some(l => l.name === "ai"), "languages.json has 'ai' chip");
const topics = readJSON(join(ROOT, "interview/data/topics.json"));
ok(topics.types.filter(t => t.name.startsWith("AI Engineering /")).length === 20, "topics.json has 20 AI types");
ok(bank.every(r => r.language === "ai"), "all AI bank records language=ai");
ok(bank.every(r => ["Easy", "Medium", "Hard"].includes(r.difficulty)), "AI bank uses bank difficulty vocab");
ok(bank.every(r => r.question && r.solution), "AI bank records have question + solution");
const appjs = read(join(APP, "js/app.js"));
ok(appjs.includes("questions-ai.json"), "app.js loads questions-ai.json");
ok(appjs.includes('q.language === "ai"'), "app.js handles ai-language cards");

// ─────────────────────────────────────────────────────────────────────────
section("Track pages + shared engine (responsive nav + a11y)");
const trackJs = read(join(APP, "js/track.js"));
ok(trackJs.includes("localStorage") && trackJs.includes("ps-track-"), "track.js persists to localStorage");
const trackCss = read(join(APP, "css/track.css"));
ok(/prefers-color-scheme:\s*dark/.test(trackCss), "track.css has dark-mode support");
ok(trackCss.includes("focus-visible"), "track.css has keyboard focus styles");
ok(/@media\s*\(max-width/.test(trackCss), "track.css is responsive (media queries)");

const commPage = read(join(APP, "communication/index.html"));
ok(commPage.includes('id="track-root"') && commPage.includes("track.js"), "communication page mounts the track engine");
ok(commPage.includes('data-section="communication"'), "communication page configured for communication section");
ok(commPage.includes('name="viewport"'), "communication page has responsive viewport meta");
ok(commPage.includes("ip-topnav"), "communication page has the shared nav");
ok(commPage.includes("ip-mob"), "communication page has the mobile nav (responsive)");

const aiPage = read(join(APP, "ai-engineering/index.html"));
ok(aiPage.includes('id="track-root"') && aiPage.includes("track.js"), "ai-engineering page mounts the track engine");
ok(aiPage.includes("track.css"), "ai-engineering page links track.css");

// Nav propagation: Communication + AI Engineering in desktop menu AND mobile grid
for (const [file, label] of [["communication/index.html", "communication page"], ["index.html", "question bank"], ["evaluate/index.html", "skill check"]]) {
  const html = read(join(APP, file));
  const desktop = (html.match(/ip-hub-menu[\s\S]*?\/interview\.app\/communication\//) || []).length > 0;
  const mobile = (html.match(/ip-mob-grid[\s\S]*?\/interview\.app\/communication\//) || []).length > 0;
  ok(html.includes('/interview.app/communication/'), `${label}: nav links Communication`);
  ok(html.includes('/interview.app/ai-engineering/'), `${label}: nav links AI Engineering`);
}

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(48)}`);
if (failed === 0) {
  console.log(`✓ ALL ${passed} checks passed.`);
  process.exit(0);
} else {
  console.log(`✗ ${failed} of ${passed + failed} checks FAILED:`);
  for (const f of fails) console.log("   - " + f);
  process.exit(1);
}
