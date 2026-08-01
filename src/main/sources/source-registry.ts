import type { ProviderId, SourceSettings } from '../../shared/domain'
import type { SessionSource } from './session-source'

export interface SourceRegistry {
  all(): SessionSource[]
  get(providerId: ProviderId): SessionSource | undefined
  enabled(settings: SourceSettings['enabledSources']): SessionSource[]
}

export function createSourceRegistry(
  sources: readonly SessionSource[]
): SourceRegistry {
  const ordered = [...sources]
  const byProvider = new Map<ProviderId, SessionSource>()

  for (const source of ordered) {
    if (byProvider.has(source.providerId)) {
      throw new Error(`Duplicate source provider ID: ${source.providerId}`)
    }
    byProvider.set(source.providerId, source)
  }

  return Object.freeze({
    all: () => [...ordered],
    get: (providerId: ProviderId) => byProvider.get(providerId),
    enabled: (settings: SourceSettings['enabledSources']) =>
      ordered.filter((source) => settings[source.providerId])
  })
}
