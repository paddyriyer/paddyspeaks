// Career Prep engine tests, run against the generated content.
//   node interview.app/careers/tests/engine.mjs
// No network, no browser. Wired into Validate Content.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const E = require("../js/engine.js");
const data = JSON.parse(readFileSync(new URL("../data/careers.json", import.meta.url)));
const trackQs = (id) => JSON.parse(readFileSync(new URL(`../data/tracks/${id}.json`, import.meta.url))).questions;
const cats = Object.fromEntries(data.categories.map((c) => [c.id, c]));
const roles = Object.fromEntries(data.roles.map((r) => [r.id, r]));
const tracks = Object.fromEntries(data.tracks.map((t) => [t.id, t]));
let n = 0;
const t = (name, fn) => { fn(); n++; };

t("every Career Prep role has a five-round loop with one question per round", () => {
  for (const r of data.roles.filter((r) => r.prep === "careers")) {
    const tr = tracks[r.track];
    const qs = trackQs(tr.id);
    for (const level of E.LEVELS) {
      const plan = E.roundPlan(tr, qs, level, 42);
      assert.equal(plan.length, 5, r.id);
      const ids = plan.map((p) => p.qid);
      assert.ok(ids.every(Boolean), `${r.id} ${level}`);
      assert.equal(new Set(ids).size, 5, `${r.id}: no question twice in one loop`);
      plan.forEach((p, i) => assert.ok(tr.rounds[i].pool.includes(p.qid)));
    }
  }
});

t("a role's curriculum is its track's categories, emphasis first", () => {
  for (const r of data.roles.filter((r) => r.prep === "careers")) {
    const tr = tracks[r.track];
    const cur = E.curriculum(r, tr, cats, trackQs(tr.id));
    assert.deepEqual(new Set(cur.map((c) => c.id)), new Set(tr.categories), r.id);
    const firstPlain = cur.findIndex((c) => !c.emphasis);
    assert.ok(cur.slice(firstPlain === -1 ? cur.length : firstPlain).every((c) => !c.emphasis));
    for (const c of cur) assert.ok(c.questions.length > 0, `${r.id} ${c.id} has questions`);
  }
});

t("PM and TPM roles get different loops", () => {
  const pm = tracks[roles.pm.track], tpm = tracks[roles.tpm.track], tech = tracks[roles.technical_pm.track];
  assert.notEqual(pm.id, tpm.id);
  assert.notEqual(tech.id, tpm.id);
  assert.deepEqual(tpm.rounds.map((r) => r.title),
    ["Technical Architecture", "Program Execution", "Risk and Dependency Management", "Stakeholder Escalation", "Behavioural and Leadership"]);
  assert.deepEqual(pm.rounds.map((r) => r.title),
    ["Product Sense", "Product Execution", "Strategy and Prioritisation", "Analytics and Experimentation", "Leadership and Behavioural"]);
  assert.deepEqual(tracks.ai_pm.rounds.map((r) => r.title),
    ["AI Product Strategy", "Technical AI Literacy", "AI Evaluation and Safety", "Product Execution", "Cross-functional Leadership"]);
  const a = new Set(trackQs(pm.id).map((q) => q.prompt)), b = trackQs(tpm.id).map((q) => q.prompt);
  assert.ok(b.every((p) => !a.has(p)));
});

t("level preference: a director loop prefers director-level questions", () => {
  const tr = tracks.pm_leadership, qs = trackQs("pm_leadership");
  const plan = E.roundPlan(tr, qs, "director", 7);
  const byId = Object.fromEntries(qs.map((q) => [q.id, q]));
  for (const p of plan) assert.ok(byId[p.qid].levels.includes("director") || tr.rounds[p.n - 1].pool.every((id) => !byId[id].levels.includes("director")));
});

t("plans are reproducible from the seed", () => {
  const tr = tracks.tpm, qs = trackQs("tpm");
  assert.deepEqual(E.roundPlan(tr, qs, "senior", 99), E.roundPlan(tr, qs, "senior", 99));
});

t("swapping a question never repeats one already in the loop", () => {
  const tr = tracks.pm_core, qs = trackQs("pm_core");
  const plan = E.roundPlan(tr, qs, "mid", 3);
  const swapped = E.swapQuestion(tr, plan, 2, qs, "mid", 5);
  assert.ok(tr.rounds[2].pool.includes(swapped));
  assert.ok(plan.every((p, i) => i === 2 || p.qid !== swapped));
});

t("self-assessment arithmetic ignores invalid scores and finds weak dimensions", () => {
  const attempt = { rounds: [
    { scores: { metrics: 2, communication: 4, bogus: 9 } },
    { scores: { metrics: 1, tradeoffs: 3 } },
    { scores: {} }] };
  const avg = E.dimAverages(attempt);
  assert.deepEqual(avg, { metrics: 1.5, communication: 4, tradeoffs: 3 });
  assert.equal(E.overall(attempt), (2 + 4 + 1 + 3) / 4);
  assert.deepEqual(E.weakest(avg, 2), ["metrics"]);
  assert.equal(E.roundAverage({ scores: {} }), null);
});

t("recommendations train the weak dimensions, unpractised first", () => {
  const qs = trackQs("pm_core");
  const rec = E.recommend(qs, ["metrics"], { "pm-metrics-01": { at: 1 } }, 3);
  assert.ok(rec.length > 0);
  for (const id of rec) assert.ok(qs.find((q) => q.id === id).dimensions.includes("metrics"));
  assert.notEqual(rec[0], "pm-metrics-01");
});

t("reported questions match only on the role's own names", () => {
  const rep = [{ roles_reported: [{ name: "Technical Program Manager" }] }, { roles_reported: [{ name: "Data Architect" }] }, { roles_reported: [] }];
  assert.equal(E.reportedForRole(rep, roles.tpm).length, 1);
  assert.equal(E.reportedForRole(rep, roles.pm).length, 0);
});

console.log(`career prep engine: ${n} checks passed`);
