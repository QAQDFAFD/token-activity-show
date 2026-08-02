import { describe, expect, it, vi } from 'vitest'
import type { NormalizedSession, SourceSettings } from '../../../src/shared/domain'
import type { SessionSource } from '../../../src/main/sources/session-source'
import { createSourceRegistry } from '../../../src/main/sources/source-registry'
import { RefreshCoordinator } from '../../../src/main/refresh/refresh-coordinator'

const settings: SourceSettings = {
  enabledSources: { 'claude-code': true, codex: true, hermes: false },
  refreshIntervalMinutes: 10
}

const session = (providerId: 'claude-code' | 'codex'): NormalizedSession => ({
  id: `${providerId}:one`,
  providerId,
  sourceSessionId: 'one',
  startedAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:01:00.000Z',
  projectName: null,
  workingDirectory: null,
  model: null,
  interactionCount: null,
  tokenUsage: null,
  activeDurationSeconds: null,
  contentVersion: 'v1'
})

function source(
  providerId: 'claude-code' | 'codex',
  scan: SessionSource['scan']
): SessionSource {
  return { providerId, detect: vi.fn(), scan }
}

describe('RefreshCoordinator', () => {
  it('skips an overlapping refresh', async () => {
    let resolveScan!: (value: Awaited<ReturnType<SessionSource['scan']>>) => void
    const scan = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<SessionSource['scan']>>>((resolve) => {
          resolveScan = resolve
        })
    )
    const coordinator = new RefreshCoordinator({
      registry: createSourceRegistry([source('claude-code', scan)]),
      sessions: { upsertMany: vi.fn() },
      getSettings: () => settings
    })

    const first = coordinator.refresh('manual')
    expect(await coordinator.refresh('scheduled')).toEqual({
      status: 'skipped',
      reason: 'already-running'
    })
    resolveScan({
      sessions: [session('claude-code')],
      warnings: [],
      capabilities: {
        interactions: false,
        tokens: false,
        activeDuration: false,
        model: false,
        trustworthyQuota: false
      },
      fingerprint: 'one'
    })

    await first
    expect(scan).toHaveBeenCalledTimes(1)
  })

  it('isolates provider failures and reports unchanged rows', async () => {
    const upsertMany = vi.fn(() => ({ inserted: 0, updated: 0, unchanged: 1 }))
    const coordinator = new RefreshCoordinator({
      registry: createSourceRegistry([
        source('claude-code', vi.fn(async () => {
          throw new Error('unreadable')
        })),
        source('codex', vi.fn(async () => ({
          sessions: [session('codex')],
          warnings: [{ code: 'PARTIAL', message: 'one record skipped' }],
          capabilities: {
            interactions: false,
            tokens: false,
            activeDuration: false,
            model: false,
            trustworthyQuota: false
          },
          fingerprint: 'codex-v1'
        })))
      ]),
      sessions: { upsertMany },
      getSettings: () => settings
    })

    expect(await coordinator.refresh('manual')).toEqual({
      status: 'complete',
      trigger: 'manual',
      providers: 2,
      succeeded: 1,
      failed: 1,
      inserted: 0,
      updated: 0,
      unchanged: 1,
      warnings: 1
    })
    expect(upsertMany).toHaveBeenCalledOnce()
  })
})
