export const PROVIDER_IDS = ['claude-code', 'codex', 'hermes'] as const

export type ProviderId = (typeof PROVIDER_IDS)[number]

export interface MetricCapabilities {
  interactions: boolean
  tokens: boolean
  activeDuration: boolean
  model: boolean
  trustworthyQuota: boolean
}

export interface NormalizedSession {
  id: string
  providerId: ProviderId
  sourceSessionId: string
  startedAt: string
  updatedAt: string
  projectName: string | null
  workingDirectory: string | null
  model: string | null
  interactionCount: number | null
  tokenUsage: number | null
  activeDurationSeconds: number | null
  contentVersion: string
}

export interface DailyMetrics {
  date: string
  providerId: ProviderId
  sessionCount: number
  interactionCount: number | null
  tokenUsage: number | null
  activeDurationSeconds: number | null
  capabilities: MetricCapabilities
}

export interface SourceSettings {
  enabledSources: Record<ProviderId, boolean>
  refreshIntervalMinutes: number
}

export interface UpsertResult {
  inserted: number
  updated: number
  unchanged: number
}
