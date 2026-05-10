// Async wrapper around PGlite (Postgres-WASM) — same shape as SqliteEngine.
// PGlite is loaded lazily from CDN the first time the user picks the
// Postgres runtime, keeping the default-SQLite payload unchanged.
import { planRowsForSpec, pgTypeFor } from "../sample-gen.js";

// esm.sh rewrites bare imports so pglite's internal modules load cleanly in
// a browser without a bundler. Pinning the version keeps the runtime stable
// when upstream ships breaking changes.
const PGLITE_CDN = "https://esm.sh/@electric-sql/pglite@0.4.5";

// In Postgres, double-quoted identifiers preserve case; unquoted ones get
// folded to lowercase. The interview corpus often references columns in
// lowercase even when CSVs ship them in CamelCase, so for plain identifiers
// we deliberately emit DDL UNquoted — Postgres lowercases them and the
// queries resolve. Only fall back to quoting when the name has spaces,
// punctuation, or starts with a digit (legitimate cases that need quoting).
const PLAIN_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
function quoteIdent(name) {
  const s = String(name);
  if (PLAIN_IDENT.test(s)) return s;
  return '"' + s.replace(/"/g, '""') + '"';
}

// Map sample-gen's CSV-inferred SQLite types onto Postgres equivalents so
// loadCSV creates a real Postgres table rather than relying on text-only
// columns (which would break date arithmetic in the reference solutions).
function csvTypeToPg(t) {
  if (t === "INTEGER") return "INTEGER";
  if (t === "REAL") return "DOUBLE PRECISION";
  return "TEXT";
}

// PGlite sends back JS Date objects for DATE / TIMESTAMP columns; stringify
// them back to ISO so the results table renders consistently with the
// SQLite path (which returns strings).
function normalizeValue(v) {
  if (v instanceof Date) {
    // Drop the Z so it matches the rest of the playground's timestamp shape
    return v.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  }
  return v;
}

export class PgliteEngine {
  constructor() {
    this.kind = "postgres";
    this.label = "PostgreSQL (PGlite)";
    this.db = null;
  }

  async init() {
    const mod = await import(/* webpackIgnore: true */ PGLITE_CDN);
    const PGlite = mod.PGlite || mod.default?.PGlite || mod.default;
    if (!PGlite) throw new Error("PGlite module did not expose a PGlite class");
    this.db = await PGlite.create();
  }

  async reset() {
    // Wipe public schema; cheaper than re-instantiating PGlite.
    await this.db.exec(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
    `);
  }

  async loadCSV(name, headers, types, rows) {
    const colDefs = headers
      .map((h, i) => `${quoteIdent(h)} ${csvTypeToPg(types[i])}`)
      .join(", ");
    await this.db.exec(`DROP TABLE IF EXISTS ${quoteIdent(name)};`);
    await this.db.exec(`CREATE TABLE ${quoteIdent(name)} (${colDefs});`);
    if (!rows.length) return;
    const placeholders = headers.map((_, i) => "$" + (i + 1)).join(",");
    const insertSql = `INSERT INTO ${quoteIdent(name)} VALUES (${placeholders})`;
    for (const row of rows) {
      await this.db.query(insertSql, row);
    }
  }

  async loadSpec(spec, opts) {
    const plan = planRowsForSpec(spec, opts);
    const summary = [];
    for (const { table, colMeta, rows } of plan) {
      const colDefs = colMeta.map((m) => `${quoteIdent(m.name)} ${pgTypeFor(m)}`).join(", ");
      await this.db.exec(`DROP TABLE IF EXISTS ${quoteIdent(table)};`);
      await this.db.exec(`CREATE TABLE ${quoteIdent(table)} (${colDefs});`);
      const placeholders = colMeta.map((_, i) => "$" + (i + 1)).join(",");
      const insertSql = `INSERT INTO ${quoteIdent(table)} VALUES (${placeholders})`;
      for (const r of rows) {
        const params = colMeta.map((m) => r[m.name]);
        await this.db.query(insertSql, params);
      }
      summary.push({ table, rows: rows.length, cols: colMeta.map((m) => `${m.name}:${pgTypeFor(m)}`) });
    }
    return summary;
  }

  // Returns an array of {columns, values} so the renderer can be shared with
  // the sql.js path. Multi-statement SQL: split into statements (best-effort)
  // and run each one; only return the LAST result set with rows so the user
  // sees the answer rather than INSERT 0 N from a setup block.
  async exec(sql) {
    // PGlite supports its own multi-statement parser via .exec, but that
    // path doesn't return typed result sets. Use .query for individual
    // statements — splitter is paren/string-aware to survive PL/pgSQL-free
    // interview SQL.
    const stmts = splitStatements(sql);
    const all = [];
    for (const s of stmts) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      const res = await this.db.query(trimmed);
      if (res.fields && res.fields.length && res.rows && res.rows.length !== undefined) {
        all.push({
          columns: res.fields.map((f) => f.name),
          values: res.rows.map((row) =>
            res.fields.map((f) => normalizeValue(row[f.name]))
          ),
        });
      }
    }
    return all;
  }

  async listTables() {
    const res = await this.db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    );
    return res.rows.map((r) => r.tablename);
  }

  async tableInfo(name) {
    const cols = await this.db.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
       ORDER BY ordinal_position`,
      [name]
    );
    let count = 0;
    try {
      const cnt = await this.db.query(`SELECT COUNT(*) AS n FROM ${quoteIdent(name)}`);
      count = Number(cnt.rows[0]?.n ?? 0);
    } catch (e) {
      // table might be empty / missing — fall back to 0
    }
    return {
      cols: cols.rows.map((r) => ({ name: r.column_name, type: r.data_type })),
      count,
    };
  }

  async dropTable(name) {
    await this.db.exec(`DROP TABLE IF EXISTS ${quoteIdent(name)}`);
  }
}

// Best-effort SQL statement splitter. Skips ;'s inside single-quoted strings,
// double-quoted identifiers, line comments, block comments, and parens. Good
// enough for the interview-bank corpus, which is plain DDL+DML+SELECT (no
// dollar-quoted PL/pgSQL bodies).
function splitStatements(sql) {
  const out = [];
  let depth = 0;
  let cur = [];
  let inSingle = false;
  let inDouble = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const n = sql[i + 1];
    if (inLine) {
      cur.push(c);
      if (c === "\n") inLine = false;
      continue;
    }
    if (inBlock) {
      cur.push(c);
      if (c === "*" && n === "/") { cur.push(n); i++; inBlock = false; }
      continue;
    }
    if (inSingle) {
      cur.push(c);
      if (c === "'" && n === "'") { cur.push(n); i++; }
      else if (c === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      cur.push(c);
      if (c === '"' && n === '"') { cur.push(n); i++; }
      else if (c === '"') inDouble = false;
      continue;
    }
    if (c === "-" && n === "-") { cur.push(c); inLine = true; continue; }
    if (c === "/" && n === "*") { cur.push(c); inBlock = true; continue; }
    if (c === "'") { cur.push(c); inSingle = true; continue; }
    if (c === '"') { cur.push(c); inDouble = true; continue; }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (c === ";" && depth === 0) {
      out.push(cur.join(""));
      cur = [];
      continue;
    }
    cur.push(c);
  }
  if (cur.length) out.push(cur.join(""));
  return out;
}
