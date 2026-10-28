import init from '../migrations/0001_init.sql?raw';
import renderedPages from '../migrations/0002_rendered_pages.sql?raw';
import media from '../migrations/0003_media.sql?raw';

/**
 * Migrations are bundled into the Worker and applied on first use, so a fresh
 * deploy needs no separate migration step. They are recorded in the same
 * `d1_migrations` table Wrangler uses, so `wrangler d1 migrations` stays compatible.
 * Add new files here in order; every statement must be safe to re-run.
 */
const MIGRATIONS: [name: string, sql: string][] = [
  ['0001_init.sql', init],
  ['0002_rendered_pages.sql', renderedPages],
  ['0003_media.sql', media],
];

// A flag, not a shared promise: Workers can't await one request's I/O from another.
let migrated = false;

export async function ensureSchema(db: D1Database): Promise<void> {
  if (migrated) return;
  await migrate(db); // idempotent, so concurrent first requests are safe
  migrated = true;
}

async function migrate(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS d1_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    )
    .run();
  const { results } = await db.prepare('SELECT name FROM d1_migrations').all<{ name: string }>();
  const applied = new Set(results.map((r) => r.name));

  for (const [name, sql] of MIGRATIONS) {
    if (applied.has(name)) continue;
    const statements = sql
      .replace(/^\s*--.*$/gm, '')
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => db.prepare(s));
    statements.push(db.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)').bind(name));
    await db.batch(statements);
  }
}

/* ------------------------------------------------------------------ */
/* Site documents                                                      */
/* ------------------------------------------------------------------ */

export type DocumentId = 'draft' | 'published';

export interface DocumentRow {
  data: string;
  revision: number;
  updatedAt: string;
  updatedBy: string | null;
}

export function getDocument(db: D1Database, id: DocumentId) {
  return db
    .prepare('SELECT data, revision, updatedAt, updatedBy FROM documents WHERE id = ?')
    .bind(id)
    .first<DocumentRow>();
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function getOrCreateSetting(db: D1Database, key: string, create: () => string) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  if (row) return row.value;
  await db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(key, create()).run();
  // Re-read so concurrent first requests all agree on the winner.
  const saved = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  return saved!.value;
}
