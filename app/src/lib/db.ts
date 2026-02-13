import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Re-export shared types for server-side consumers
export type { RecordRow, RecordVersionRow, TagRow, AgentRow } from './types';
import type { RecordRow, RecordVersionRow, TagRow, AgentRow } from './types';

// ── Server-only Types ──────────────────────────────────────

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface RecordLinkRow {
  id: number;
  source_record_id: number;
  target_record_id: number;
  link_type: string;
  note: string | null;
  created_at: string;
}

export interface ExerciseSessionRow {
  id: number;
  user_id: number;
  exercise_id: string;
  status: string;
  messages: string;
  output_record_id: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface AnalyticsEventRow {
  id: number;
  user_id: number;
  event: string;
  source: string;
  metadata: string | null;
  created_at: string;
}

// ── Migrations ─────────────────────────────────────────────

const MIGRATIONS = [
  {
    id: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        domain TEXT NOT NULL,
        record_type TEXT NOT NULL,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        structured_data TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        source_detail TEXT,
        priority INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        pinned INTEGER NOT NULL DEFAULT 0,
        record_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, domain, slug)
      );

      CREATE INDEX IF NOT EXISTS idx_records_user_domain ON records(user_id, domain);
      CREATE INDEX IF NOT EXISTS idx_records_user_status ON records(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_records_user_priority ON records(user_id, priority DESC);

      CREATE TABLE IF NOT EXISTS record_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        structured_data TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        color TEXT,
        UNIQUE(user_id, name)
      );

      CREATE TABLE IF NOT EXISTS record_tags (
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (record_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS record_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        target_record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        link_type TEXT NOT NULL DEFAULT 'related',
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_record_links_source ON record_links(source_record_id);
      CREATE INDEX IF NOT EXISTS idx_record_links_target ON record_links(target_record_id);

      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tagline TEXT NOT NULL DEFAULT '',
        system_prompt TEXT NOT NULL DEFAULT '',
        avatar TEXT NOT NULL DEFAULT '🤖',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS exercise_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        exercise_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_progress',
        messages TEXT NOT NULL DEFAULT '[]',
        output_record_id INTEGER REFERENCES records(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS contributor_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        domains TEXT NOT NULL DEFAULT '[]',
        expires_at TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS contributor_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contributor_link_id INTEGER NOT NULL REFERENCES contributor_links(id),
        content TEXT NOT NULL,
        record_id INTEGER REFERENCES records(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS api_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        permissions TEXT NOT NULL DEFAULT '[]',
        last_used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        event TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'web',
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS auth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    id: 2,
    sql: `
      CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(
        title, content, domain, record_type,
        content=records,
        content_rowid=id
      );

      CREATE TRIGGER IF NOT EXISTS records_ai AFTER INSERT ON records BEGIN
        INSERT INTO records_fts(rowid, title, content, domain, record_type)
        VALUES (new.id, new.title, new.content, new.domain, new.record_type);
      END;

      CREATE TRIGGER IF NOT EXISTS records_ad AFTER DELETE ON records BEGIN
        INSERT INTO records_fts(records_fts, rowid, title, content, domain, record_type)
        VALUES ('delete', old.id, old.title, old.content, old.domain, old.record_type);
      END;

      CREATE TRIGGER IF NOT EXISTS records_au AFTER UPDATE ON records BEGIN
        INSERT INTO records_fts(records_fts, rowid, title, content, domain, record_type)
        VALUES ('delete', old.id, old.title, old.content, old.domain, old.record_type);
        INSERT INTO records_fts(rowid, title, content, domain, record_type)
        VALUES (new.id, new.title, new.content, new.domain, new.record_type);
      END;
    `,
  },
];

function runMigrations(d: Database.Database) {
  d.exec(`CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY)`);
  const applied = new Set(
    d
      .prepare('SELECT id FROM migrations')
      .all()
      .map((r: any) => r.id)
  );
  for (const m of MIGRATIONS) {
    if (!applied.has(m.id)) {
      d.transaction(() => {
        d.exec(m.sql);
        d.prepare('INSERT INTO migrations (id) VALUES (?)').run(m.id);
      })();
    }
  }
}

// ── Singleton ──────────────────────────────────────────────

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const dbPath =
    process.env.DB_PATH ||
    path.join(process.cwd(), 'strategy-kernel.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  runMigrations(_db);
  return _db;
}

// ── User Queries ───────────────────────────────────────────

export function getUserByEmail(email: string): UserRow | undefined {
  return db().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
}

export function createUser(email: string, passwordHash: string): UserRow {
  const result = db()
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email, passwordHash);
  return db().prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as UserRow;
}

// ── Record Queries ─────────────────────────────────────────

export function getRecords(
  userId: number,
  opts?: {
    domain?: string;
    status?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
  }
): RecordRow[] {
  const conditions = ['user_id = ?'];
  const params: any[] = [userId];

  if (opts?.domain) {
    conditions.push('domain = ?');
    params.push(opts.domain);
  }
  if (opts?.status) {
    conditions.push('status = ?');
    params.push(opts.status);
  }

  const orderBy = opts?.orderBy || 'updated_at DESC';
  const limit = opts?.limit || 100;
  const offset = opts?.offset || 0;

  return db()
    .prepare(
      `SELECT * FROM records WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as RecordRow[];
}

export function getRecord(userId: number, domain: string, slug: string): RecordRow | undefined {
  return db()
    .prepare('SELECT * FROM records WHERE user_id = ? AND domain = ? AND slug = ?')
    .get(userId, domain, slug) as RecordRow | undefined;
}

export function getRecordById(userId: number, id: number): RecordRow | undefined {
  return db()
    .prepare('SELECT * FROM records WHERE user_id = ? AND id = ?')
    .get(userId, id) as RecordRow | undefined;
}

export function upsertRecord(
  userId: number,
  data: {
    domain: string;
    record_type: string;
    slug: string;
    title: string;
    content: string;
    structured_data?: string | null;
    source?: string;
    source_detail?: string | null;
    priority?: number;
    status?: string;
    pinned?: number;
    record_date?: string | null;
  }
): RecordRow {
  const d = db();
  const existing = getRecord(userId, data.domain, data.slug);

  if (existing) {
    // Save version before updating
    d.prepare(
      'INSERT INTO record_versions (record_id, content, structured_data) VALUES (?, ?, ?)'
    ).run(existing.id, existing.content, existing.structured_data);

    d.prepare(
      `UPDATE records SET
        record_type = ?, title = ?, content = ?, structured_data = ?,
        source = ?, source_detail = ?, priority = ?, status = ?,
        pinned = ?, record_date = ?, updated_at = datetime('now')
      WHERE id = ?`
    ).run(
      data.record_type,
      data.title,
      data.content,
      data.structured_data ?? existing.structured_data,
      data.source || existing.source,
      data.source_detail ?? existing.source_detail,
      data.priority ?? existing.priority,
      data.status || existing.status,
      data.pinned ?? existing.pinned,
      data.record_date ?? existing.record_date,
      existing.id
    );

    return getRecordById(userId, existing.id)!;
  }

  const result = d
    .prepare(
      `INSERT INTO records (user_id, domain, record_type, slug, title, content, structured_data, source, source_detail, priority, status, pinned, record_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      data.domain,
      data.record_type,
      data.slug,
      data.title,
      data.content,
      data.structured_data ?? null,
      data.source || 'manual',
      data.source_detail ?? null,
      data.priority ?? 0,
      data.status || 'active',
      data.pinned ?? 0,
      data.record_date ?? null
    );

  return getRecordById(userId, result.lastInsertRowid as number)!;
}

export function deleteRecord(userId: number, id: number): boolean {
  const result = db()
    .prepare('DELETE FROM records WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return result.changes > 0;
}

export function getRecordVersions(recordId: number): RecordVersionRow[] {
  return db()
    .prepare('SELECT * FROM record_versions WHERE record_id = ? ORDER BY created_at DESC')
    .all(recordId) as RecordVersionRow[];
}

// ── Full-Text Search ───────────────────────────────────────

export function searchRecords(userId: number, query: string, domain?: string): RecordRow[] {
  const ftsQuery = query
    .split(/\s+/)
    .map((w) => `"${w}"*`)
    .join(' ');

  if (domain) {
    return db()
      .prepare(
        `SELECT r.* FROM records r
         JOIN records_fts fts ON fts.rowid = r.id
         WHERE records_fts MATCH ? AND r.user_id = ? AND r.domain = ?
         ORDER BY rank LIMIT 50`
      )
      .all(ftsQuery, userId, domain) as RecordRow[];
  }

  return db()
    .prepare(
      `SELECT r.* FROM records r
       JOIN records_fts fts ON fts.rowid = r.id
       WHERE records_fts MATCH ? AND r.user_id = ?
       ORDER BY rank LIMIT 50`
    )
    .all(ftsQuery, userId) as RecordRow[];
}

// ── Tags ───────────────────────────────────────────────────

export function getTagsForRecord(recordId: number): TagRow[] {
  return db()
    .prepare(
      `SELECT t.* FROM tags t
       JOIN record_tags rt ON rt.tag_id = t.id
       WHERE rt.record_id = ?`
    )
    .all(recordId) as TagRow[];
}

export function getRecordsByTag(userId: number, tagName: string): RecordRow[] {
  return db()
    .prepare(
      `SELECT r.* FROM records r
       JOIN record_tags rt ON rt.record_id = r.id
       JOIN tags t ON t.id = rt.tag_id
       WHERE r.user_id = ? AND t.name = ?
       ORDER BY r.updated_at DESC`
    )
    .all(userId, tagName) as RecordRow[];
}

export function addTagToRecord(userId: number, recordId: number, tagName: string): void {
  const d = db();
  d.prepare('INSERT OR IGNORE INTO tags (user_id, name) VALUES (?, ?)').run(userId, tagName);
  const tag = d
    .prepare('SELECT id FROM tags WHERE user_id = ? AND name = ?')
    .get(userId, tagName) as { id: number };
  d.prepare('INSERT OR IGNORE INTO record_tags (record_id, tag_id) VALUES (?, ?)').run(
    recordId,
    tag.id
  );
}

// ── Record Links ───────────────────────────────────────────

export function linkRecords(
  sourceId: number,
  targetId: number,
  linkType: string = 'related',
  note?: string
): void {
  db()
    .prepare(
      'INSERT OR IGNORE INTO record_links (source_record_id, target_record_id, link_type, note) VALUES (?, ?, ?, ?)'
    )
    .run(sourceId, targetId, linkType, note ?? null);
}

export function getLinkedRecords(userId: number, recordId: number): (RecordRow & { link_type: string; link_note: string | null })[] {
  return db()
    .prepare(
      `SELECT r.*, rl.link_type, rl.note as link_note FROM records r
       JOIN record_links rl ON (rl.target_record_id = r.id OR rl.source_record_id = r.id)
       WHERE (rl.source_record_id = ? OR rl.target_record_id = ?)
         AND r.id != ? AND r.user_id = ?
       ORDER BY r.updated_at DESC`
    )
    .all(recordId, recordId, recordId, userId) as any[];
}

// ── Agents ─────────────────────────────────────────────────

export function getAgents(userId: number): AgentRow[] {
  return db()
    .prepare('SELECT * FROM agents WHERE user_id = ? ORDER BY name')
    .all(userId) as AgentRow[];
}

export function createAgent(
  userId: number,
  data: { name: string; description: string; tagline: string; system_prompt: string; avatar: string }
): AgentRow {
  const result = db()
    .prepare(
      'INSERT INTO agents (user_id, name, description, tagline, system_prompt, avatar) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(userId, data.name, data.description, data.tagline, data.system_prompt, data.avatar);
  return db().prepare('SELECT * FROM agents WHERE id = ?').get(result.lastInsertRowid) as AgentRow;
}

// ── Exercise Sessions ──────────────────────────────────────

export function createExerciseSession(userId: number, exerciseId: string): ExerciseSessionRow {
  const result = db()
    .prepare('INSERT INTO exercise_sessions (user_id, exercise_id) VALUES (?, ?)')
    .run(userId, exerciseId);
  return db()
    .prepare('SELECT * FROM exercise_sessions WHERE id = ?')
    .get(result.lastInsertRowid) as ExerciseSessionRow;
}

export function updateExerciseSession(
  id: number,
  data: { messages?: string; status?: string; output_record_id?: number; completed_at?: string }
): void {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.messages !== undefined) {
    sets.push('messages = ?');
    params.push(data.messages);
  }
  if (data.status) {
    sets.push('status = ?');
    params.push(data.status);
  }
  if (data.output_record_id !== undefined) {
    sets.push('output_record_id = ?');
    params.push(data.output_record_id);
  }
  if (data.completed_at) {
    sets.push('completed_at = ?');
    params.push(data.completed_at);
  }
  if (sets.length === 0) return;
  params.push(id);
  db()
    .prepare(`UPDATE exercise_sessions SET ${sets.join(', ')} WHERE id = ?`)
    .run(...params);
}

// ── Analytics ──────────────────────────────────────────────

export function trackEvent(userId: number, event: string, source: string, metadata?: any): void {
  db()
    .prepare('INSERT INTO analytics_events (user_id, event, source, metadata) VALUES (?, ?, ?, ?)')
    .run(userId, event, source, metadata ? JSON.stringify(metadata) : null);
}

export function getAnalytics(
  userId: number,
  opts?: { event?: string; since?: string; limit?: number }
): AnalyticsEventRow[] {
  const conditions = ['user_id = ?'];
  const params: any[] = [userId];

  if (opts?.event) {
    conditions.push('event = ?');
    params.push(opts.event);
  }
  if (opts?.since) {
    conditions.push('created_at >= ?');
    params.push(opts.since);
  }

  return db()
    .prepare(
      `SELECT * FROM analytics_events WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(...params, opts?.limit || 100) as AnalyticsEventRow[];
}

// ── Utility ────────────────────────────────────────────────

export function getAllRecordContentsForUser(userId: number): RecordRow[] {
  return db()
    .prepare(
      "SELECT * FROM records WHERE user_id = ? AND status = 'active' ORDER BY domain, priority DESC, title"
    )
    .all(userId) as RecordRow[];
}

export function getRecentActivity(userId: number, days: number = 7): RecordRow[] {
  return db()
    .prepare(
      `SELECT * FROM records WHERE user_id = ? AND updated_at >= datetime('now', ?) ORDER BY updated_at DESC`
    )
    .all(userId, `-${days} days`) as RecordRow[];
}

export function getDomainSummary(userId: number, domain: string): { count: number; records: RecordRow[] } {
  const records = getRecords(userId, { domain, status: 'active' });
  return { count: records.length, records };
}
