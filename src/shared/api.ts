import type {
  DailyMetrics,
  NormalizedSession,
  ProviderId,
  SourceSettings
} from './domain'
import type { Result } from './result'
import type { GetTodayInput, UpdateSettingsInput } from './schemas'

export const IPC_CHANNELS = Object.freeze({
  getToday: 'token-activity-show:get-today',
  refreshNow: 'token-activity-show:refresh-now',
  getSettings: 'token-activity-show:get-settings',
  updateSettings: 'token-activity-show:update-settings',
  refreshState: 'token-activity-show:refresh-state'
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

export interface TodayIntensity {
  status: 'insufficient-data' | 'preliminary' | 'established'
  comparison: 'provisional'
  score: number
  band: 'very-low' | 'low' | 'normal' | 'high' | 'very-high'
  explanation: string
}

export interface TodayViewModel {
  summary: null
  localDate?: string
  timeZone?: string
  coveredAt?: string
  refreshState?: RefreshState
  overall?: Omit<DailyMetrics, 'date' | 'providerId' | 'capabilities'>
  providers?: readonly ProviderTodayMetrics[]
  recentSessions?: readonly NormalizedSession[]
  intensity?: TodayIntensity
  metricAvailability?: {
    interactions: boolean
    tokens: boolean
    activeDuration: boolean
  }
  precisionExplanation?: string
}

export type RefreshTrigger = 'manual' | 'scheduled'

export interface CompletedRefreshReport {
  status: 'complete'
  trigger: RefreshTrigger
  providers: number
  succeeded: number
  failed: number
  inserted: number
  updated: number
  unchanged: number
  warnings: number
}

export interface SkippedRefreshReport {
  status: 'skipped'
  reason: 'already-running'
}

export interface FailedRefreshReport {
  status: 'failed'
  trigger: RefreshTrigger
  reason: string
}

export type RefreshReport =
  | CompletedRefreshReport
  | SkippedRefreshReport
  | FailedRefreshReport

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
