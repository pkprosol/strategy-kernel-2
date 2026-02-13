import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ── Types ──────────────────────────────────────────────────

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface RecordRow {
  id: number;
  user_id: number;
  domain: string;
  record_type: string;
  slug: string;
  title: string;
  content: string;
  structured_data: string | null;
  source: string;
  source_detail: string | null;
  priority: number;
  status: string;
  pinned: number;
  record_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecordVersionRow {
  id: number;
  record_id: number;
  content: string;
  structured_data: string | null;
  created_at: string;
}

export interface TagRow {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
}

export interface AgentRow {
  id: number;
  user_id: number;
  name: string;
  description: string;
  tagline: string;
  system_prompt: string;
  avatar: string;
  created_at: string;
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

      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        event TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'mcp',
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
    d.prepare('SELECT id FROM migrations').all().map((r: any) => r.id)
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
    path.join(process.cwd(), '..', 'app', 'strategy-kernel.db');
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

// ── Record Queries ─────────────────────────────────────────

export function getRecords(
  userId: number,
  opts?: { domain?: string; status?: string; limit?: number }
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

  const limit = opts?.limit || 100;
  return db()
    .prepare(
      `SELECT * FROM records WHERE ${conditions.join(' AND ')} ORDER BY priority DESC, updated_at DESC LIMIT ?`
    )
    .all(...params, limit) as RecordRow[];
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
    record_date?: string | null;
  }
): RecordRow {
  const d = db();
  const existing = getRecord(userId, data.domain, data.slug);

  if (existing) {
    d.prepare(
      'INSERT INTO record_versions (record_id, content, structured_data) VALUES (?, ?, ?)'
    ).run(existing.id, existing.content, existing.structured_data);

    d.prepare(
      `UPDATE records SET
        record_type = ?, title = ?, content = ?, structured_data = ?,
        source = ?, source_detail = ?, priority = ?, status = ?,
        record_date = ?, updated_at = datetime('now')
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
      data.record_date ?? existing.record_date,
      existing.id
    );

    return getRecordById(userId, existing.id)!;
  }

  const result = d
    .prepare(
      `INSERT INTO records (user_id, domain, record_type, slug, title, content, structured_data, source, source_detail, priority, status, record_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId, data.domain, data.record_type, data.slug, data.title, data.content,
      data.structured_data ?? null, data.source || 'mcp', data.source_detail ?? null,
      data.priority ?? 0, data.status || 'active', data.record_date ?? null
    );

  return getRecordById(userId, result.lastInsertRowid as number)!;
}

export function getRecordVersions(recordId: number): RecordVersionRow[] {
  return db()
    .prepare('SELECT * FROM record_versions WHERE record_id = ? ORDER BY created_at DESC')
    .all(recordId) as RecordVersionRow[];
}

// ── Full-Text Search ───────────────────────────────────────

export function searchRecords(userId: number, query: string, domain?: string): RecordRow[] {
  const ftsQuery = query.split(/\s+/).map((w) => `"${w}"*`).join(' ');

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

export function getLinkedRecords(userId: number, recordId: number): RecordRow[] {
  return db()
    .prepare(
      `SELECT r.* FROM records r
       JOIN record_links rl ON (rl.target_record_id = r.id OR rl.source_record_id = r.id)
       WHERE (rl.source_record_id = ? OR rl.target_record_id = ?)
         AND r.id != ? AND r.user_id = ?
       ORDER BY r.updated_at DESC`
    )
    .all(recordId, recordId, recordId, userId) as RecordRow[];
}

// ── Agents ─────────────────────────────────────────────────

export function getAgents(userId: number): AgentRow[] {
  return db()
    .prepare('SELECT * FROM agents WHERE user_id = ? ORDER BY name')
    .all(userId) as AgentRow[];
}

// ── Analytics ──────────────────────────────────────────────

export function trackEvent(userId: number, event: string, metadata?: any): void {
  db()
    .prepare('INSERT INTO analytics_events (user_id, event, source, metadata) VALUES (?, ?, ?, ?)')
    .run(userId, event, 'mcp', metadata ? JSON.stringify(metadata) : null);
}

export function getAnalytics(
  userId: number,
  opts?: { event?: string; since?: string; limit?: number }
): AnalyticsEventRow[] {
  const conditions = ['user_id = ?'];
  const params: any[] = [userId];
  if (opts?.event) { conditions.push('event = ?'); params.push(opts.event); }
  if (opts?.since) { conditions.push('created_at >= ?'); params.push(opts.since); }
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
