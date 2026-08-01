import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../../src/main/db/open-database'

const temporaryDirectories: string[] = []

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'token-show-migrations-'))
  temporaryDirectories.push(directory)
  return join(directory, 'token-show.sqlite')
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('openDatabase', () => {
  it('applies migration 001 once and enables required pragmas', () => {
    const path = temporaryDatabasePath()
    const first = openDatabase(path)

    expect(first.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(first.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(first.pragma('busy_timeout', { simple: true })).toBe(5000)
    expect(
      first
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        )
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        'daily_metrics',
        'provider_installations',
        'schema_migrations',
        'sessions',
        'settings'
      ])
    )
    first.close()

    const second = openDatabase(path)
    expect(
      second
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all()
    ).toEqual([{ version: 1 }])
    second.close()
  })
})
