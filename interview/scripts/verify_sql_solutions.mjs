// Verify every SQL reference solution by executing it against synthetic data
// in PGlite (the same Postgres-WASM engine the playground uses). Catches
// solutions that fail to run — dialect mismatches, missing columns, syntax
// errors. Semantic bugs (runs, but wrong answer) are NOT caught here.
//
//   node interview/scripts/verify_sql_solutions.mjs
//
// Writes a full report to interview/data/solution_audit.json.
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const sg = await import(
  pathToFileURL(path.join(ROOT, "interview.app/js/sample-gen.js")).href
);
const { PGlite } = await import(
  pathToFileURL(path.join(ROOT, "interview.app/vendor/pglite/index.js")).href
);

const questions = JSON.parse(
  fs.readFileSync(path.join(ROOT, "interview/data/questions.json"), "utf8")
);
const schemas = JSON.parse(
  fs.readFileSync(path.join(ROOT, "interview/data/question_schemas.json"), "utf8")
);

// ── ported verbatim from interview.app/js/sql.js ─────────────────────────
function extractWindowHints(sql) {
  const partition = new Set();
  const orderByInWindow = new Set();
  const categoryHints = {};
  if (!sql) return { partition, orderByInWindow, categoryHints };
  const stripStrings = (s) =>
    s
      .replace(/'(?:''|\\'|[^'])*'/g, "''")
      .replace(/"(?:""|\\"|[^"])*"/g, '""')
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
  const cleaned = stripStrings(sql);
  const partRe =
    /\bPARTITION\s+BY\s+([\s\S]+?)(?=\bORDER\s+BY\b|\bROWS\b|\bRANGE\b|\)|$)/gi;
  let m;
  while ((m = partRe.exec(cleaned)) !== null) {
    splitColList(m[1]).forEach((c) => partition.add(c));
  }
  const overRe = /\bOVER\s*\(([\s\S]*?)\)/gi;
  while ((m = overRe.exec(cleaned)) !== null) {
    const inside = m[1];
    const ord = /\bORDER\s+BY\s+([\s\S]+?)(?=\bROWS\b|\bRANGE\b|$)/i.exec(inside);
    if (ord) splitColList(ord[1]).forEach((c) => orderByInWindow.add(c));
  }
  const noComments = String(sql)
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const addLit = (col, lit) => {
    if (!col || lit == null) return;
    const c = col.toLowerCase();
    if (!categoryHints[c]) categoryHints[c] = new Set();
    categoryHints[c].add(lit);
  };
  const eqRe = /\b(\w+)\s*=\s*'((?:[^']|'')*)'/g;
  while ((m = eqRe.exec(noComments)) !== null)
    addLit(m[1], m[2].replace(/''/g, "'"));
  const inRe =
    /\b(\w+)\s+IN\s*\(\s*('(?:[^']|'')*'(?:\s*,\s*'(?:[^']|'')*')*)\s*\)/gi;
  while ((m = inRe.exec(noComments)) !== null) {
    const col = m[1];
    const litList = m[2];
    const litRe = /'((?:[^']|'')*)'/g;
    let lm;
    while ((lm = litRe.exec(litList)) !== null)
      addLit(col, lm[1].replace(/''/g, "'"));
  }
  return { partition, orderByInWindow, categoryHints };
}
function splitColList(text) {
  return text
    .split(",")
    .map((part) => {
      const tok = part
        .trim()
        .replace(/\s+(ASC|DESC|NULLS\s+(FIRST|LAST))\b.*$/i, "")
        .trim();
      const last = tok.split(".").pop().replace(/[`"\[\]]/g, "").trim();
      return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(last) ? last.toLowerCase() : null;
    })
    .filter(Boolean);
}

// ── DDL builder ──────────────────────────────────────────────────────────
function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function buildDDL(plan) {
  let sql = "";
  for (const { table, colMeta, rows } of plan) {
    const cols = colMeta.map((m) => `"${m.name}" ${sg.pgTypeFor(m)}`).join(", ");
    sql += `CREATE TABLE "${table}" (${cols});\n`;
    for (const r of rows) {
      const vals = colMeta.map((m) => lit(r[m.name])).join(",");
      sql += `INSERT INTO "${table}" VALUES (${vals});\n`;
    }
  }
  return sql;
}

// ── sweep ────────────────────────────────────────────────────────────────
const sqlQs = questions.filter((q) => q.language === "sql");
const db = new PGlite();
const results = [];
let n = 0;
for (const q of sqlQs) {
  n++;
  if (n % 100 === 0) process.stderr.write(`  ${n}/${sqlQs.length}\n`);
  const rec = { id: q.id, batch: q.batch, dialect: !!q.dialect_token };
  const spec = schemas[q.id];
  if (!spec || !spec.length) {
    rec.status = "no-schema";
    results.push(rec);
    continue;
  }
  const hints = extractWindowHints(q.solution || "");
  const categoryHints = {};
  for (const [col, set] of Object.entries(hints.categoryHints))
    categoryHints[col] = [...set];
  let ddl;
  try {
    const plan = sg.planRowsForSpec(spec, {
      seed: sg.seedFromQid(q.id),
      partitionCols: [...hints.partition],
      windowOrderCols: [...hints.orderByInWindow],
      categoryHints,
    });
    ddl = buildDDL(plan);
  } catch (e) {
    rec.status = "plan-error";
    rec.msg = String(e.message || e).split("\n")[0];
    results.push(rec);
    continue;
  }
  try {
    await db.exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await db.exec(ddl);
    const res = await db.query(q.solution || "");
    rec.status = "ok";
    rec.rows = res.rows.length;
  } catch (e) {
    rec.status = "error";
    rec.msg = String(e.message || e).split("\n")[0];
  }
  results.push(rec);
}
await db.close();

fs.writeFileSync(
  path.join(ROOT, "interview/data/solution_audit.json"),
  JSON.stringify(results, null, 1)
);

// ── summary ──────────────────────────────────────────────────────────────
const by = (pred) => results.filter(pred);
const count = (pred) => by(pred).length;
console.log(`\n══ SQL SOLUTION VERIFICATION ══  (${sqlQs.length} SQL questions)\n`);
console.log(`  ok (runs)            : ${count((r) => r.status === "ok")}`);
console.log(`    └ returns 0 rows   : ${count((r) => r.status === "ok" && r.rows === 0)}`);
console.log(`  error (won't run)    : ${count((r) => r.status === "error")}`);
console.log(`    └ dialect-flagged  : ${count((r) => r.status === "error" && r.dialect)}`);
console.log(`    └ NOT dialect      : ${count((r) => r.status === "error" && !r.dialect)}`);
console.log(`  no schema spec       : ${count((r) => r.status === "no-schema")}`);
console.log(`  plan-error           : ${count((r) => r.status === "plan-error")}`);
const byBatch = {};
for (const r of by((r) => r.status === "error" && !r.dialect)) {
  byBatch[r.batch] = (byBatch[r.batch] || 0) + 1;
}
console.log(`\n  non-dialect failures by batch:`, byBatch);
console.log(`\n  full report → interview/data/solution_audit.json`);
