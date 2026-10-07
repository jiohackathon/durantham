import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Keep runtime data outside the Git checkout by default. This avoids Windows permission
// problems when a demo is launched from a protected or synced project folder.
const defaultDatabaseFile = () => {
  return path.join(os.tmpdir(), 'Duramint', 'service-platform.sqlite');
};

export function createDatabase(file = process.env.DATABASE_FILE || defaultDatabaseFile()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, technician_id TEXT UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','dispatcher','technician','requester')), site TEXT, skills TEXT DEFAULT '[]', skill_focus TEXT, rating REAL, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS machines (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, site TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', required_skills TEXT DEFAULT '[]', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS parts (id INTEGER PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0), reorder_level INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS service_requests (id INTEGER PRIMARY KEY, machine_id INTEGER NOT NULL REFERENCES machines(id), requester_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT, issue_type TEXT, priority TEXT NOT NULL CHECK(priority IN ('low','medium','high','urgent')), required_skills TEXT DEFAULT '[]', preferred_skills TEXT DEFAULT '[]', required_parts TEXT DEFAULT '[]', status TEXT NOT NULL DEFAULT 'pending_approval' CHECK(status IN ('pending_approval','approved','assigned','in_progress','completed','cancelled','exception')), assigned_to INTEGER REFERENCES users(id), due_at TEXT, completed_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS part_reservations (id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL REFERENCES service_requests(id), part_id INTEGER NOT NULL REFERENCES parts(id), quantity INTEGER NOT NULL CHECK(quantity > 0), UNIQUE(request_id, part_id));
    CREATE TABLE IF NOT EXISTS task_logs (id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL REFERENCES service_requests(id), author_id INTEGER NOT NULL REFERENCES users(id), note TEXT NOT NULL, status TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL REFERENCES service_requests(id), author_id INTEGER NOT NULL REFERENCES users(id), url TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'document', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), message TEXT NOT NULL, read_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS audit_events (id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id), entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, action TEXT NOT NULL, metadata TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
  // Migration for databases created before technician profiles and issue typing were added.
  const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
  for (const [column, definition] of [['technician_id', 'TEXT'], ['skill_focus', 'TEXT'], ['rating', 'REAL']]) {
    if (!userColumns.has(column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
  }
  const requestColumns = new Set(db.prepare('PRAGMA table_info(service_requests)').all().map(c => c.name));
  for (const [column, definition] of [['issue_type', 'TEXT'], ['preferred_skills', "TEXT DEFAULT '[]'"]]) {
    if (!requestColumns.has(column)) db.exec(`ALTER TABLE service_requests ADD COLUMN ${column} ${definition}`);
  }
  return db;
}

export function one(db, sql, ...params) { return db.prepare(sql).get(...params); }
export function many(db, sql, ...params) { return db.prepare(sql).all(...params); }
export function run(db, sql, ...params) { return db.prepare(sql).run(...params); }
export function audit(db, actorId, entityType, entityId, action, metadata = {}) { run(db, 'INSERT INTO audit_events (actor_id, entity_type, entity_id, action, metadata) VALUES (?, ?, ?, ?, ?)', actorId, entityType, entityId, action, JSON.stringify(metadata)); }
export function notify(db, userId, message) { if (userId) run(db, 'INSERT INTO notifications (user_id, message) VALUES (?, ?)', userId, message); }
