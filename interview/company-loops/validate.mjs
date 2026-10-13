#!/usr/bin/env node
/* Prove every executable template's generator against its reference solution.

     node interview/company-loops/validate.mjs            # all companies, default seeds
     node interview/company-loops/validate.mjs --seeds 30 --only OAI-L1-01

   For each executable template, for each seed and each supported level:
     - every {{placeholder}} the template uses is supplied by the generator;
     - SQL: the setup runs in PostgreSQL (PGlite, the same engine the page uses),
       the evaluator's reference SQL returns exactly the generator's expected rows,
       in order, and the expected result is not empty; no diagnostic equals it;
     - Python: the reference implementation equals the generator's oracle on every
       sample and every test with an expect, and clears each timing test with room
       to spare (pyrun.py).
   Run after interview/company-loops/build.py (it reads the built data). */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const APP = path.join(ROOT, "interview.app", "company-loops");
const { makeRng } = await import(pathToFileURL(path.join(APP, "js", "rng.js")).href);
const { compareRows, rowKey } = await import(pathToFileURL(path.join(APP, "js", "compare.js")).href);

const args = process.argv.slice(2);
const SEEDS = Number(args[args.indexOf("--seeds") + 1]) || 10;
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const index = JSON.parse(readFileSync(path.join(APP, "data", "index.json"), "utf8"));
const problems = [];
let instances = 0;
let pg = null;
const pyJobs = [];

async function db() {
  if (!pg) {
    const { PGlite } = await import(pathToFileURL(path.join(ROOT, "interview.app", "vendor", "pglite", "index.js")).href);
    const asText = (v) => v;
    pg = await PGlite.create({ parsers: { 16: asText, 20: asText, 1082: asText, 1114: asText, 1184: asText, 1186: asText, 1700: asText } });
  }
  return pg;
}
const fillSql = (sql, vars) => sql.replace(/\{\{(\w+)\}\}/g, (a, k) => (k in vars ? String(vars[k]) : a));

for (const c of index.companies.filter((x) => x.status === "available")) {
  const cand = JSON.parse(readFileSync(path.join(APP, "data", c.id + ".json"), "utf8"));
  const ev = JSON.parse(readFileSync(path.join(APP, "data", c.id + ".eval.json"), "utf8"));
  for (const t of cand.templates) {
    if (!t.generator || (ONLY && t.id !== ONLY)) continue;
    const mod = await import(pathToFileURL(path.join(APP, t.generator)).href);
    const ref = ev.templates[t.id];
    const job = { id: t.id, code: ref.reference_python, entry: mod.entry, prelude: mod.prelude || "", cases: [] };
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const level of t.levels) {
        const inst = mod.generate(makeRng(seed * 7919 + level), level);
        instances++;
        const where = `${t.id} seed ${seed} level ${level}`;
        const vars = Object.assign({}, inst.vars || {});
        const missing = t.placeholders.filter((p) => !(p in vars) && !(t.params && p in t.params));
        if (missing.length) problems.push(`${where}: generator does not supply ${missing.join(", ")}`);
        if (t.kind === "sql") {
          const d = await db();
          await d.exec("DISCARD ALL");
          await d.exec("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; SET search_path TO public; SET client_min_messages TO warning;");
          try {
            await d.exec(inst.setup);
          } catch (e) {
            problems.push(`${where}: setup failed: ${e.message}`);
            continue;
          }
          let res;
          try {
            res = await d.exec(fillSql(ref.reference_sql, vars));
          } catch (e) {
            problems.push(`${where}: reference SQL failed: ${e.message}`);
            continue;
          }
          const last = [...res].reverse().find((x) => x.fields && x.fields.length);
          const rows = last.rows.map((row) => last.fields.map((f) => row[f.name]));
          if (!inst.expected.rows.length) problems.push(`${where}: expected result is empty`);
          if (last.fields.length !== inst.expected.columns.length) problems.push(`${where}: reference returns ${last.fields.length} columns, expected ${inst.expected.columns.length}`);
          const how = compareRows(rows, inst.expected.rows);
          if (how !== "exact") {
            problems.push(`${where}: reference SQL ${how === "order" ? "returns the right rows in a different order" : "disagrees with the generator"}\n    reference: ${JSON.stringify(rows).slice(0, 300)}\n    generator: ${JSON.stringify(inst.expected.rows).slice(0, 300)}`);
          }
          for (const dg of inst.diagnostics || []) {
            if (compareRows(dg.rows, inst.expected.rows)) problems.push(`${where}: a diagnostic equals the expected result: ${dg.message.slice(0, 60)}`);
          }
        } else {
          for (const s of inst.samples || []) job.cases.push({ name: `${where} sample`, args: s.args, expect: s.expect });
          for (const tc of inst.tests || []) {
            // A timing test has no fixed expect; run it once per level (seed 1) to time the reference.
            if (tc.expect == null && seed !== 1) continue;
            job.cases.push({ name: `${where} ${tc.name}`, args: tc.args, expect: tc.expect ?? null, limit_s: seed === 1 ? tc.limit_s ?? null : null });
          }
        }
      }
    }
    if (t.kind !== "sql") pyJobs.push(job);
  }
}
if (pg) await pg.close();

let pyCases = 0;
if (pyJobs.length) {
  const r = spawnSync("python3", [path.join(HERE, "pyrun.py")], { input: JSON.stringify(pyJobs), encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) problems.push("pyrun.py failed: " + r.stderr);
  else {
    const out = JSON.parse(r.stdout);
    problems.push(...out.problems);
    pyCases = out.cases;
  }
}

if (problems.length) {
  console.log(problems.join("\n"));
  console.log(`\n✗ ${problems.length} problem(s) across ${instances} generated instances`);
  process.exit(1);
}
console.log(`✓ company-loops: ${instances} generated instances proven (${pyCases} Python cases), ${SEEDS} seeds per level`);
