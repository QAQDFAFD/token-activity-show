import { describe, expect, it } from 'vitest'
import { aggregateHourlyActivity } from '../../../src/main/metrics/aggregate-hourly'
import type { NormalizedSession } from '../../../src/shared/domain'

function session(overrides: Partial<NormalizedSession> = {}): NormalizedSession {
  return {
    id: 'claude-code:one',
    providerId: 'claude-code',
    sourceSessionId: 'one',
    startedAt: '2026-08-02T01:00:00.000Z',
    updatedAt: '2026-08-02T02:00:00.000Z',
    projectName: null,
    workingDirectory: null,
    model: null,
    interactionCount: null,
    interactionEvents: [],
    tokenUsage: null,
    activeDurationSeconds: null,
    contentVersion: 'v1',
    ...overrides
  }
}

describe('aggregateHourlyActivity', () => {
  it('returns exactly 24 local-hour buckets', () => {
    const buckets = aggregateHourlyActivity([], '2026-08-02', 'UTC')

    expect(buckets).toHaveLength(24)
    expect(buckets.map((bucket) => bucket.hour)).toEqual(
      Array.from({ length: 24 }, (_, hour) => hour)
    )
  })

  it('counts interactions into local hours and converts midnight boundaries', () => {
    const buckets = aggregateHourlyActivity([
      session({ interactionEvents: ['2026-08-01T16:00:00.000Z', '2026-08-01T16:30:00.000Z'] }),
      session({ id: 'claude-code:two', sourceSessionId: 'two', interactionEvents: ['2026-08-01T17:00:00.000Z'] }),
      session({ id: 'claude-code:previous-day', sourceSessionId: 'previous-day', interactionEvents: ['2026-08-01T15:59:00.000Z'] })
    ], '2026-08-02', 'Asia/Shanghai')

    expect(buckets.find((bucket) => bucket.hour === 0)?.byProvider['claude-code']).toBe(2)
    expect(buckets.find((bucket) => bucket.hour === 1)?.byProvider['claude-code']).toBe(1)
    expect(buckets.find((bucket) => bucket.hour === 0)?.totalInteractions).toBe(2)
    expect(buckets.find((bucket) => bucket.hour === 23)?.byProvider['claude-code']).toBe(0)
  })

  it('keeps every hour of an available provider as a known zero', () => {
    const buckets = aggregateHourlyActivity([
      session({ interactionEvents: ['2026-08-02T08:15:00.000Z'] })
    ], '2026-08-02', 'UTC')

    expect(buckets.every((bucket) => bucket.byProvider['claude-code'] === 0)).toBe(false)
    expect(buckets.find((bucket) => bucket.hour === 8)?.byProvider['claude-code']).toBe(1)
    expect(buckets.filter((bucket) => bucket.byProvider['claude-code'] === 0)).toHaveLength(23)
  })

  it('sums provider segments into the hour total', () => {
    const buckets = aggregateHourlyActivity([
      session({ interactionEvents: ['2026-08-02T08:00:00.000Z'] }),
      session({ id: 'claude-code:two', sourceSessionId: 'two', interactionEvents: ['2026-08-02T08:30:00.000Z'] }),
      session({ id: 'codex:one', providerId: 'codex', sourceSessionId: 'one', interactionEvents: ['2026-08-02T08:10:00.000Z'] })
    ], '2026-08-02', 'UTC')

    const hour8 = buckets.find((bucket) => bucket.hour === 8)
    expect(hour8?.byProvider).toEqual({ 'claude-code': 2, codex: 1, hermes: null })
    expect(hour8?.totalInteractions).toBe(3)
  })

  it('marks providers without sessions as unavailable and leaves the total unknown', () => {
    const buckets = aggregateHourlyActivity([
      session({ interactionEvents: ['2026-08-02T08:00:00.000Z'] })
    ], '2026-08-02', 'UTC')

    expect(buckets.find((bucket) => bucket.hour === 8)?.byProvider.codex).toBeNull()
    expect(buckets.find((bucket) => bucket.hour === 8)?.byProvider.hermes).toBeNull()
    expect(buckets.find((bucket) => bucket.hour === 8)?.totalInteractions).toBe(1)
  })

  it('keeps hourly values null when a provider has sessions without event timestamps', () => {
    const buckets = aggregateHourlyActivity([
      session({ interactionCount: 4, interactionEvents: [] })
    ], '2026-08-02', 'UTC')

    expect(buckets.every((bucket) => bucket.byProvider['claude-code'] === null)).toBe(true)
    expect(buckets.every((bucket) => bucket.totalInteractions === null)).toBe(true)
  })

  it('returns an all-unavailable chart when no provider has event-level data', () => {
    const buckets = aggregateHourlyActivity([], '2026-08-02', 'UTC')
    const first = buckets[0]
    if (first === undefined) throw new Error('Expected 24 buckets')

    expect(buckets.every((bucket) => bucket.totalInteractions === null)).toBe(true)
    expect(first.byProvider).toEqual({ 'claude-code': null, codex: null, hermes: null })
  })

  it('ignores events on other local dates and invalid timestamps', () => {
    const buckets = aggregateHourlyActivity([
      session({ interactionEvents: ['2026-08-01T23:00:00.000Z', 'not-a-timestamp'] })
    ], '2026-08-02', 'UTC')

    expect(buckets.every((bucket) => bucket.byProvider['claude-code'] === 0)).toBe(true)
    expect(buckets.every((bucket) => bucket.totalInteractions === 0)).toBe(true)
  })
})
