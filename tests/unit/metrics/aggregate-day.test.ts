import { describe, expect, it } from 'vitest'
import { aggregateDay } from '../../../src/main/metrics/aggregate-day'
import type { NormalizedSession } from '../../../src/shared/domain'

function session(overrides: Partial<NormalizedSession> = {}): NormalizedSession {
  return {
    id: 'codex:one',
    providerId: 'codex',
    sourceSessionId: 'one',
    startedAt: '2026-08-02T01:00:00.000Z',
    updatedAt: '2026-08-02T02:00:00.000Z',
    projectName: null,
    workingDirectory: null,
    model: null,
    interactionCount: null,
    tokenUsage: null,
    activeDurationSeconds: null,
    contentVersion: 'v1',
    ...overrides
  }
}

describe('aggregateDay', () => {
  it('groups sessions by provider and preserves unavailable metrics', () => {
    expect(aggregateDay([
      session(),
      session({ id: 'codex:two', sourceSessionId: 'two', interactionCount: 3 }),
      session({ id: 'hermes:one', providerId: 'hermes', sourceSessionId: 'one' })
    ], '2026-08-02', 'UTC')).toEqual([
      {
        date: '2026-08-02',
        providerId: 'codex',
        sessionCount: 2,
        interactionCount: null,
        tokenUsage: null,
        activeDurationSeconds: null,
        capabilities: {
          interactions: false,
          tokens: false,
          activeDuration: false,
          model: false,
          trustworthyQuota: false
        }
      },
      expect.objectContaining({ providerId: 'hermes', sessionCount: 1 })
    ])
  })

  it('uses the requested local date and assigns crossing sessions by start', () => {
    const sessions = [session({ startedAt: '2026-08-01T17:00:00.000Z' })]

    expect(aggregateDay(sessions, '2026-08-02', 'Asia/Shanghai')).toHaveLength(1)
    expect(aggregateDay(sessions, '2026-08-01', 'America/Los_Angeles')).toHaveLength(1)
    expect(aggregateDay(sessions, '2026-08-02', 'America/Los_Angeles')).toEqual([])
  })

  it('sums available metrics when every session provides them', () => {
    const result = aggregateDay([
      session({ interactionCount: 2, tokenUsage: 100, activeDurationSeconds: 30 }),
      session({ id: 'codex:two', sourceSessionId: 'two', interactionCount: 4, tokenUsage: 250, activeDurationSeconds: 50 })
    ], '2026-08-02', 'UTC')[0]

    expect(result).toMatchObject({ interactionCount: 6, tokenUsage: 350, activeDurationSeconds: 80 })
    expect(result?.capabilities).toMatchObject({ interactions: true, tokens: true, activeDuration: true })
  })
})
