// Jobs board filter engine tests, run against the committed board.
//   node interview.app/jobs/tests/filters.mjs
// No network, no browser. Wired into Validate Content.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const F = require("../../js/jobs-filters.js");
const board = JSON.parse(readFileSync(new URL("../data/jobs.json", import.meta.url)));
const careers = JSON.parse(readFileSync(new URL("../../careers/data/careers.json", import.meta.url)));
const jobs = board.jobs;
let n = 0;
const t = (name, fn) => { fn(); n++; };

const S = (o) => Object.assign(F.emptyState(), o);
const live = jobs.filter((j) => j.status !== "expired");

t("no filters = every live listing", () => {
  assert.equal(F.filterJobs(jobs, S({})).length, live.length);
});

t("family filter returns only that family (primary or secondary)", () => {
  for (const fam of careers.families) {
    const rows = F.filterJobs(jobs, S({ family: [fam.id] }));
    for (const j of rows) assert.ok(j.families.includes(fam.id), `${j.role} in ${fam.id}`);
    assert.equal(rows.length, live.filter((j) => j.families.includes(fam.id)).length);
  }
});

t("PM and TPM filters do not mix", () => {
  const pm = F.filterJobs(jobs, S({ role: ["pm", "senior_pm"] }));
  const tpm = F.filterJobs(jobs, S({ role: ["tpm", "senior_tpm"] }));
  assert.ok(pm.length > 0 && tpm.length > 0, "the board has both PM and TPM roles");
  assert.ok(pm.every((j) => !/program manager/i.test(j.role)), "no program manager in PM results");
  assert.ok(tpm.every((j) => /program manager|tpm/i.test(j.role)), "TPM results are program roles");
  assert.ok(tpm.every((j) => !/product manager/i.test(j.role)));
});

t("filters combine (AND across facets, OR within one)", () => {
  const st = S({ family: ["product"], seniority: ["senior", "staff_principal"], workplace: ["remote"] });
  for (const j of F.filterJobs(jobs, st)) {
    assert.ok(j.families.includes("product"));
    assert.ok(["senior", "staff_principal"].includes(j.seniority));
    assert.equal(j.workplace, "remote");
  }
});

t("facet counts equal the result of ticking that option", () => {
  const st = S({ family: ["product"] });
  const counts = F.facetCounts(jobs, st, "seniority");
  for (const [lvl, c] of Object.entries(counts)) {
    assert.equal(F.filterJobs(jobs, S({ family: ["product"], seniority: [lvl] })).length, c, lvl);
  }
  const fc = F.facetCounts(jobs, st, "family");
  assert.equal(fc.product, F.filterJobs(jobs, S({ family: ["product"] })).length);
});

t("salary floor shows only USD postings that state a salary at or above it", () => {
  const rows = F.filterJobs(jobs, S({ salary: "200000" }));
  assert.ok(rows.length > 0);
  for (const j of rows) {
    assert.equal(j.salary.currency, "USD");
    assert.ok(Math.max(j.salary.min, j.salary.max) >= 200000);
  }
  const listed = F.filterJobs(jobs, S({ salary: "listed" }));
  assert.ok(listed.every((j) => j.salary));
});

t("keyword search needs every word", () => {
  const rows = F.filterJobs(jobs, S({ q: "program manager security" }));
  for (const j of rows) {
    const hay = [j.role, j.company, j.location, j.summary].join(" ").toLowerCase();
    for (const w of ["program", "manager", "security"]) assert.ok(hay.includes(w), j.role);
  }
});

t("expired listings are hidden unless asked for", () => {
  const fake = [...jobs, { ...live[0], id: "x", status: "expired", expired_on: "2026-01-01" }];
  assert.equal(F.filterJobs(fake, S({})).some((j) => j.id === "x"), false);
  assert.equal(F.filterJobs(fake, S({ expired: true })).some((j) => j.id === "x"), true);
});

t("URL state round-trips, and the old ?company= link still works", () => {
  const st = S({ q: "data", family: ["product", "ai_product"], seniority: ["senior"], company: ["OpenAI"],
                 salary: "150000", sort: "salary" });
  assert.deepEqual(F.parseState(F.serializeState(st)), st);
  assert.deepEqual(F.parseState("?company=Stripe").company, ["Stripe"]);
  assert.equal(F.parseState("?sort=evil").sort, "new");
  assert.equal(F.parseState("?salary=9").salary, "");
});

t("Practice links carry role, company, seniority and the job", () => {
  const j = live.find((x) => x.family === "technical_program");
  const u = new URL(F.prepUrl(j, "mock"), "https://x.test/interview.app/jobs/");
  assert.equal(u.pathname, "/interview.app/careers/");
  assert.equal(u.searchParams.get("role"), j.role_id);
  assert.equal(u.searchParams.get("company"), j.company);
  assert.equal(u.searchParams.get("level"), j.seniority);
  assert.equal(u.searchParams.get("job"), j.id);
  assert.equal(u.searchParams.get("start"), "mock");
});

t("every role on the board exists in the taxonomy Career Prep uses", () => {
  const ids = new Set(careers.roles.map((r) => r.id));
  for (const j of jobs) assert.ok(ids.has(j.role_id), j.role_id);
});

console.log(`jobs filters: ${n} checks passed over ${jobs.length} listings`);
