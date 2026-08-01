import type {
  MetricCapabilities,
  NormalizedSession,
  ProviderId
} from '../../shared/domain'

export interface SourceDetectionCandidate {
  path: string
  kind: 'directory' | 'json' | 'jsonl' | 'sqlite' | 'unknown'
}

export interface SourceDetection {
  available: boolean
  reason?: 'NOT_INSTALLED' | 'FORMAT_NOT_ESTABLISHED' | 'INACCESSIBLE_ROOT'
  candidates: SourceDetectionCandidate[]
}

export interface ScanRequest {
  since?: string
  previousFingerprint?: string
}

export interface SourceWarning {
  code: string
  message: string
  record?: string
}

export interface SourceError {
  code: 'INACCESSIBLE_ROOT' | 'IO_ERROR'
  message: string
}

export interface SourceScanResult {
  sessions: NormalizedSession[]
  warnings: SourceWarning[]
  capabilities: MetricCapabilities
  fingerprint: string
  error?: SourceError
}

export interface SessionSource {
  readonly providerId: ProviderId
  detect(): Promise<SourceDetection>
  scan(request: ScanRequest): Promise<SourceScanResult>
}

export const unavailableMetricCapabilities = (): MetricCapabilities => ({
  interactions: false,
  tokens: false,
  activeDuration: false,
  model: false,
  trustworthyQuota: false
})
