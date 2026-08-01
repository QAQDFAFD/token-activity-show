import { describe, expect, it, vi } from 'vitest'
import type { ProviderId } from '../../../src/shared/domain'
import { createSourceRegistry } from '../../../src/main/sources/source-registry'
import type { SessionSource } from '../../../src/main/sources/session-source'

function source(providerId: ProviderId): SessionSource {
  return {
    providerId,
    detect: vi.fn(async () => ({
      available: false,
      reason: 'FORMAT_NOT_ESTABLISHED' as const,
      candidates: []
    })),
    scan: vi.fn(async () => ({
      sessions: [],
      warnings: [],
      capabilities: {
        interactions: false,
        tokens: false,
        activeDuration: false,
        model: false,
        trustworthyQuota: false
      },
      fingerprint: `${providerId}-fingerprint`
    }))
  }
}

describe('createSourceRegistry', () => {
  it('rejects duplicate provider IDs', () => {
    expect(() =>
      createSourceRegistry([source('codex'), source('codex')])
    ).toThrow('Duplicate source provider ID: codex')
  })

  it('returns only enabled sources in registration order', () => {
    const claude = source('claude-code')
    const codex = source('codex')
    const hermes = source('hermes')
    const registry = createSourceRegistry([claude, codex, hermes])

    expect(
      registry
        .enabled({ 'claude-code': true, codex: false, hermes: true })
        .map((item) => item.providerId)
    ).toEqual(['claude-code', 'hermes'])
  })

  it('preserves provider isolation when sources are retrieved', () => {
    const claude = source('claude-code')
    const codex = source('codex')
    const registry = createSourceRegistry([claude, codex])

    expect(registry.get('claude-code')).toBe(claude)
    expect(registry.get('codex')).toBe(codex)
    expect(registry.get('hermes')).toBeUndefined()
    expect(registry.all()).toEqual([claude, codex])
    expect(registry.all()).not.toBe(registry.all())
  })
})
