import { describe, expect, it, vi } from 'vitest'
import type { NormalizedSession, ProviderId, SourceSettings } from '../../../src/shared/domain'
import type { SessionSource, SourceScanResult } from '../../../src/main/sources/session-source'
import { createSourceRegistry } from '../../../src/main/sources/source-registry'
import { RefreshCoordinator } from '../../../src/main/refresh/refresh-coordinator'

const settings: SourceSettings = { enabledSources: { 'claude-code': true, codex: true, hermes: false }, refreshIntervalMinutes: 10 }
const capabilities = { interactions: false, tokens: false, activeDuration: false, model: false, trustworthyQuota: false }
const session = (providerId: 'claude-code' | 'codex'): NormalizedSession => ({ id: `${providerId}:one`, providerId, sourceSessionId: 'one', startedAt: '2026-08-02T00:00:00.000Z', updatedAt: '2026-08-02T00:01:00.000Z', projectName: null, workingDirectory: null, model: null, interactionCount: null, tokenUsage: null, activeDurationSeconds: null, contentVersion: 'v1' })
const result = (overrides: Partial<SourceScanResult> = {}): SourceScanResult => ({ sessions: [], warnings: [], capabilities, fingerprint: 'v1', ...overrides })
function source(providerId: ProviderId, scan: SessionSource['scan']): SessionSource { return { providerId, detect: vi.fn(), scan } }

function coordinator(sources: SessionSource[], upsert = { inserted: 0, updated: 0, unchanged: 0 }) {
  return new RefreshCoordinator({ registry: createSourceRegistry(sources), sessions: { upsertMany: vi.fn(() => upsert) }, getSettings: () => settings })
}

describe('RefreshCoordinator', () => {
  it('reports successful provider counts without renderer-unsafe details', async () => {
    const report = await coordinator([source('claude-code', vi.fn(async () => result({ sessions: [session('claude-code')], warnings: [{ code: 'PARTIAL', message: '/private/user/session failed' }] })))], { inserted: 1, updated: 2, unchanged: 3 }).refresh('manual')
    expect(report).toMatchObject({ status: 'complete', succeeded: 1, failed: 0, providerResults: [{ providerId: 'claude-code', status: 'succeeded', inserted: 1, updated: 2, unchanged: 3, warningCodes: ['PARTIAL'] }] })
    expect(JSON.stringify(report)).not.toContain('/private/user')
  })

  it('classifies FORMAT_NOT_ESTABLISHED as unsupported', async () => {
    const report = await coordinator([source('codex', vi.fn(async () => result({ warnings: [{ code: 'FORMAT_NOT_ESTABLISHED', message: 'hidden path' }] }))) ]).refresh('manual')
    expect(report).toMatchObject({ status: 'complete', succeeded: 0, failed: 0, providerResults: [{ providerId: 'codex', status: 'unsupported', warningCodes: ['FORMAT_NOT_ESTABLISHED'] }] })
  })

  it('sanitizes returned and thrown provider failures', async () => {
    const report = await coordinator([
      source('claude-code', vi.fn(async () => { throw new Error('/Users/private/secret') })),
      source('codex', vi.fn(async () => result({ error: { code: 'IO_ERROR', message: '/tmp/private' } })))
    ]).refresh('manual')
    expect(report).toMatchObject({ status: 'complete', succeeded: 0, failed: 2, providerResults: [
      { providerId: 'claude-code', status: 'failed', warningCodes: [] },
      { providerId: 'codex', status: 'failed', warningCodes: ['IO_ERROR'] }
    ] })
    expect(JSON.stringify(report)).not.toMatch(/Users|secret|tmp|private/)
  })

  it('reports partial outcomes and skips overlapping refreshes', async () => {
    let resolveScan!: (value: SourceScanResult) => void
    const scan = vi.fn(() => new Promise<SourceScanResult>((resolve) => { resolveScan = resolve }))
    const refresh = coordinator([source('claude-code', scan), source('codex', vi.fn(async () => { throw new Error('hidden') }))])
    const first = refresh.refresh('manual')
    expect(await refresh.refresh('scheduled')).toEqual({ status: 'skipped', reason: 'already-running' })
    resolveScan(result())
    expect(await first).toMatchObject({ status: 'complete', succeeded: 1, failed: 1 })
  })
})
