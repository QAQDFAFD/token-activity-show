import { afterEach, describe, expect, it, vi } from 'vitest'
import { openDatabase } from '../../../src/main/db/open-database'
import { SessionRepository } from '../../../src/main/db/session-repository'
import { RefreshCoordinator } from '../../../src/main/refresh/refresh-coordinator'
import { createSourceRegistry } from '../../../src/main/sources/source-registry'

const databases: ReturnType<typeof openDatabase>[] = []

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

describe('scan to database', () => {
  it('persists sessions and avoids rewriting unchanged scans', async () => {
    const database = openDatabase(':memory:')
    databases.push(database)
    const sessions = new SessionRepository(database)
    const scan = vi.fn(async () => ({
      sessions: [{
        id: 'codex:native-one',
        providerId: 'codex' as const,
        sourceSessionId: 'native-one',
        startedAt: '2026-08-02T01:00:00.000Z',
        updatedAt: '2026-08-02T01:05:00.000Z',
        projectName: 'token-activity-show',
        workingDirectory: null,
        model: null,
        interactionCount: null,
        tokenUsage: null,
        activeDurationSeconds: null,
        contentVersion: 'stable'
      }],
      warnings: [],
      capabilities: {
        interactions: false,
        tokens: false,
        activeDuration: false,
        model: false,
        trustworthyQuota: false
      },
      fingerprint: 'stable'
    }))
    const coordinator = new RefreshCoordinator({
      registry: createSourceRegistry([{
        providerId: 'codex',
        detect: vi.fn(),
        scan
      }]),
      sessions,
      getSettings: () => ({
        enabledSources: { 'claude-code': false, codex: true, hermes: false },
        refreshIntervalMinutes: 10
      })
    })

    expect(await coordinator.refresh('manual')).toMatchObject({
      status: 'complete', inserted: 1, unchanged: 0
    })
    expect(await coordinator.refresh('scheduled')).toMatchObject({
      status: 'complete', inserted: 0, unchanged: 1
    })
    expect(sessions.listByLocalDate('2026-08-02', 'UTC')).toHaveLength(1)
  })
})
