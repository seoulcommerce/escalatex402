import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';

function migrationsDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', 'migrations');
}

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      appliedAt INTEGER NOT NULL
    );
  `);
}

function listMigrationFiles() {
  const dir = migrationsDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
  return files.map((f) => ({ id: f.split('.sql')[0], file: path.join(dir, f) }));
}

export function migrate() {
  const db = getDb();
  ensureMigrationsTable(db);

  const applied = new Set(
    db
      .prepare('SELECT id FROM migrations ORDER BY id ASC')
      .all()
      .map((r) => r.id)
  );

  const files = listMigrationFiles();

  db.exec('BEGIN');
  try {
    for (const m of files) {
      if (applied.has(m.id)) continue;
      const sql = fs.readFileSync(m.file, 'utf8');
      db.exec(sql);
      db.prepare('INSERT INTO migrations(id, appliedAt) VALUES(?, ?)').run(m.id, Date.now());
      // eslint-disable-next-line no-console
      console.log(`[migrate] applied ${m.id}`);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}
