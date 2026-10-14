import Database from 'better-sqlite3';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';

const here = dirname(fileURLToPath(import.meta.url));

mkdirSync(dirname(config.DB_PATH), { recursive: true });

/** Shared SQLite connection (WAL mode). */
export const db = new Database(config.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/** Apply pending SQL migrations in filename order. */
export function migrate() {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  const dir = join(here, 'migrations');
  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    })();
  }
}

/** Create the admin user from env if the users table is empty. */
export function seedAdmin(log) {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (c > 0) return;
  const hash = bcrypt.hashSync(config.ADMIN_PASSWORD, 12);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(config.ADMIN_USERNAME, hash, 'admin');
  log?.info({ username: config.ADMIN_USERNAME }, 'admin user created from env');
}

// Run migrations at import time: services prepare statements on load, so tables must exist first.
migrate();
