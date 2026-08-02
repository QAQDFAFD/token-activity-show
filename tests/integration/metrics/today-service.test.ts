import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../../src/main/db/open-database'
import { MetricsRepository } from '../../../src/main/db/metrics-repository'
import { SessionRepository } from '../../../src/main/db/session-repository'
import { TodayService } from '../../../src/main/metrics/today-service'

const databases: ReturnType<typeof openDatabase>[] = []
afterEach(() => databases.splice(0).forEach((database) => database.close()))

describe('TodayService', () => {
  it('builds and persists an honest statistics-only view model', async () => {
    const database = openDatabase(':memory:')
    databases.push(database)
    const sessions = new SessionRepository(database)
    const metrics = new MetricsRepository(database)
    sessions.upsertMany([{
      id: 'codex:one', providerId: 'codex', sourceSessionId: 'one',
      startedAt: '2026-08-02T02:00:00.000Z', updatedAt: '2026-08-02T03:00:00.000Z',
      projectName: 'token-show', workingDirectory: null, model: null,
      interactionCount: null, tokenUsage: null, activeDurationSeconds: null,
      contentVersion: 'v1'
    }])
    const service = new TodayService({ sessions, metrics, now: () => new Date('2026-08-02T04:00:00.000Z') })

    const view = await service.get({ localDate: '2026-08-02', timeZone: 'UTC' })

    expect(view).toMatchObject({
      summary: null,
      localDate: '2026-08-02',
      timeZone: 'UTC',
      overall: { sessionCount: 1, interactionCount: null, tokenUsage: null, activeDurationSeconds: null },
      metricAvailability: { interactions: false, tokens: false, activeDuration: false },
      intensity: { status: 'insufficient-data', comparison: 'provisional' }
    })
    expect(view.providers).toEqual([expect.objectContaining({ providerId: 'codex', sessionCount: 1 })])
    expect(view.recentSessions).toHaveLength(1)
    expect(metrics.get('2026-08-02', 'codex')).toMatchObject({ sessionCount: 1, tokenUsage: null })
  })
})
