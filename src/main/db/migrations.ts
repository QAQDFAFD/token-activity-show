import type Database from 'better-sqlite3'

interface Migration {
  version: number
  statements: string
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    statements: `
      CREATE TABLE provider_installations (
        provider_id TEXT PRIMARY KEY,
        detected INTEGER NOT NULL CHECK (detected IN (0, 1)),
        capabilities_json TEXT NOT NULL,
        last_scanned_at TEXT
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        source_session_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        project_name TEXT,
        working_directory TEXT,
        model TEXT,
        interaction_count INTEGER,
        token_usage INTEGER,
        active_duration_seconds INTEGER,
        content_version TEXT NOT NULL,
        UNIQUE (provider_id, source_session_id)
      );

      CREATE INDEX sessions_started_at_idx ON sessions (started_at);

      CREATE TABLE daily_metrics (
        date TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        session_count INTEGER NOT NULL,
        interaction_count INTEGER,
        token_usage INTEGER,
        active_duration_seconds INTEGER,
        capabilities_json TEXT NOT NULL,
        PRIMARY KEY (date, provider_id)
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `
  },
  {
    version: 2,
    statements: `
      ALTER TABLE sessions ADD COLUMN interaction_events TEXT NOT NULL DEFAULT '[]';
    `
  }
]

export function migrateDatabase(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = database.prepare(
    'SELECT 1 FROM schema_migrations WHERE version = ?'
  )
  const record = database.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)'
  )

  for (const migration of migrations) {
    if (applied.get(migration.version) !== undefined) continue

    database.transaction(() => {
      database.exec(migration.statements)
      record.run(migration.version, new Date().toISOString())
    })()
  }
}
