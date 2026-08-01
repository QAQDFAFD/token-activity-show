import type { NormalizedSession, ProviderId, SourceSettings } from './domain'
import type { Result } from './result'
import type { GetTodayInput, UpdateSettingsInput } from './schemas'

export const IPC_CHANNELS = Object.freeze({
  getToday: 'token-show:get-today',
  refreshNow: 'token-show:refresh-now',
  getSettings: 'token-show:get-settings',
  updateSettings: 'token-show:update-settings',
  refreshState: 'token-show:refresh-state'
} as const)

export interface AppError {
  code: 'INVALID_INPUT' | 'INTERNAL_ERROR'
  message: string
}

export type AppSettings = SourceSettings

export interface ProviderTodayMetrics {
  providerId: ProviderId
  sessionCount: number
  interactionCount: number | null
  tokenUsage: number | null
  activeDurationSeconds: number | null
}

export interface TodayViewModel {
  summary: string | null
  providers?: readonly ProviderTodayMetrics[]
  recentSessions?: readonly NormalizedSession[]
}

export interface RefreshReport {
  status: 'complete' | 'skipped' | 'failed'
  reason?: string
}

export interface RefreshState {
  status: 'idle' | 'scanning' | 'complete' | 'failed'
  message?: string
}

export interface RendererApi {
  getToday(input: GetTodayInput): Promise<Result<TodayViewModel, AppError>>
  refreshNow(): Promise<Result<RefreshReport, AppError>>
  getSettings(): Promise<Result<AppSettings, AppError>>
  updateSettings(
    input: UpdateSettingsInput
  ): Promise<Result<AppSettings, AppError>>
  onRefreshState(listener: (state: RefreshState) => void): () => void
}
