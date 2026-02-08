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
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      createdAt INTEGER NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tags TEXT NOT NULL,
      budgetUsd TEXT,
      providerId TEXT,
      quoteUsd TEXT,
      quoteMessage TEXT,
      paymentToken TEXT,
      payTo TEXT,
      paymentReference TEXT,
      paymentMemo TEXT,
      paidTxSig TEXT,
      paidAt INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
  `);

  // Lightweight migrations (best-effort).
  try { d.exec('ALTER TABLE requests ADD COLUMN paymentMemo TEXT'); } catch {}
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
