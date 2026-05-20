// Async wrapper around sql.js (SQLite-WASM) so the playground can talk to
// SQLite and Postgres through a single interface.
import { generateAndLoad } from "../sample-gen.js";

const SQLJS_BASE = "./vendor/sql.js";

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

export class SqliteEngine {
  constructor() {
    this.kind = "sqlite";
    this.label = "SQLite (sql.js)";
    this.SQL = null;
    this.db = null;
  }

  async init() {
    if (typeof window.initSqlJs !== "function") {
      throw new Error("sql.js failed to load — check your network or ad blocker.");
    }
    this.SQL = await window.initSqlJs({
      locateFile: (file) => `${SQLJS_BASE}/${file}`,
    });
    this.db = new this.SQL.Database();
  }

  async reset() {
    if (this.db) this.db.close();
    this.db = new this.SQL.Database();
  }

  async loadCSV(name, headers, types, rows) {
    const colDefs = headers.map((h, i) => `${quoteIdent(h)} ${types[i]}`).join(", ");
    this.db.run(`DROP TABLE IF EXISTS ${quoteIdent(name)};`);
    this.db.run(`CREATE TABLE ${quoteIdent(name)} (${colDefs});`);
    const placeholders = headers.map(() => "?").join(",");
    const stmt = this.db.prepare(`INSERT INTO ${quoteIdent(name)} VALUES (${placeholders})`);
    this.db.exec("BEGIN");
    try {
      for (const row of rows) stmt.run(row);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    } finally {
      stmt.free();
    }
  }

  async loadSpec(spec, opts) {
    return generateAndLoad(this.db, spec, opts);
  }

  async exec(sql) {
    // sql.js .exec returns [{columns, values}, ...] for multi-statement SQL;
    // each result set corresponds to one statement that returned rows.
    return this.db.exec(sql);
  }

  async listTables() {
    const r = this.db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    if (!r.length) return [];
    return r[0].values.map((row) => row[0]);
  }

  async tableInfo(name) {
    const cols = this.db.exec(`PRAGMA table_info(${quoteIdent(name)})`);
    const cnt = this.db.exec(`SELECT COUNT(*) FROM ${quoteIdent(name)}`);
    return {
      cols: cols.length ? cols[0].values.map((r) => ({ name: r[1], type: r[2] })) : [],
      count: cnt.length ? cnt[0].values[0][0] : 0,
    };
  }

  async dropTable(name) {
    this.db.run(`DROP TABLE IF EXISTS ${quoteIdent(name)}`);
  }
}
