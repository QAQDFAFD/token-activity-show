import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../../src/main/db/open-database'
import { SessionRepository } from '../../../src/main/db/session-repository'
import type { NormalizedSession } from '../../../src/shared/domain'

const temporaryDirectories: string[] = []

function createRepository(): {
  repository: SessionRepository
  close: () => void
} {
  const directory = mkdtempSync(join(tmpdir(), 'token-show-sessions-'))
  temporaryDirectories.push(directory)
  const database = openDatabase(join(directory, 'token-show.sqlite'))
  return {
    repository: new SessionRepository(database),
    close: () => database.close()
  }
}

function session(
  overrides: Partial<NormalizedSession> = {}
): NormalizedSession {
  return {
    id: 'claude-code:native-1',
    providerId: 'claude-code',
    sourceSessionId: 'native-1',
    startedAt: '2026-08-01T06:30:00.000Z',
    updatedAt: '2026-08-01T07:00:00.000Z',
    projectName: null,
    workingDirectory: null,
    model: null,
    interactionCount: null,
    tokenUsage: null,
    activeDurationSeconds: null,
    contentVersion: 'version-1',
    ...overrides
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('SessionRepository', () => {
  it('inserts, skips unchanged content versions, and updates changed versions', () => {
    const { repository, close } = createRepository()

    expect(repository.upsertMany([session()])).toEqual({
      inserted: 1,
      updated: 0,
      unchanged: 0
    })
    expect(
      repository.upsertMany([
        session({ projectName: 'ignored until version changes' })
      ])
    ).toEqual({
      inserted: 0,
      updated: 0,
      unchanged: 1
    })
    expect(
      repository.upsertMany([
        session({
          contentVersion: 'version-2',
          projectName: 'Token Show',
          tokenUsage: 1200
        })
      ])
    ).toEqual({ inserted: 0, updated: 1, unchanged: 0 })
    expect(repository.listByLocalDate('2026-08-01', 'UTC')).toEqual([
      session({
        contentVersion: 'version-2',
        projectName: 'Token Show',
        tokenUsage: 1200
      })
    ])

    close()
  })

  it('enforces provider and native source-session uniqueness', () => {
    const { repository, close } = createRepository()

    repository.upsertMany([session()])
    expect(() =>
      repository.upsertMany([
        session({ id: 'different-normalized-id', contentVersion: 'version-2' })
      ])
    ).toThrow()

    close()
  })

  it('lists sessions by their start date in the requested time zone', () => {
    const { repository, close } = createRepository()
    repository.upsertMany([
      session({
        id: 'one',
        sourceSessionId: 'one',
        startedAt: '2026-08-01T06:30:00.000Z'
      }),
      session({
        id: 'two',
        sourceSessionId: 'two',
        startedAt: '2026-08-01T08:30:00.000Z'
      })
    ])

    expect(
      repository
        .listByLocalDate('2026-07-31', 'America/Los_Angeles')
        .map(({ id }) => id)
    ).toEqual(['one'])
    expect(
      repository
        .listByLocalDate('2026-08-01', 'America/Los_Angeles')
        .map(({ id }) => id)
    ).toEqual(['two'])

    close()
  })
})
