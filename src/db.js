import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || './data.db';

/** @type {Database.Database | null} */
let db = null;

export function getDb() {
  if (db) return db;
  db = new Database(DB_PATH);
  return db;
}

export function initDb() {
  // Kept for compatibility with older code paths; real migrations happen in src/migrate.js.
  getDb();
}

export function run(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  const info = stmt.run(params);
  return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
}

export function get(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  return stmt.get(params) || null;
}

export function all(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  return stmt.all(params) || [];
}
