import { contentVersion } from './version'
import { unavailableMetricCapabilities, type SourceScanResult } from './session-source'

export function unsupportedScanResult(providerId: string): SourceScanResult {
  return {
    sessions: [],
    warnings: [
      {
        code: 'FORMAT_NOT_ESTABLISHED',
        message: `No evidenced local session format is established for ${providerId}.`
      }
    ],
    capabilities: unavailableMetricCapabilities(),
    fingerprint: contentVersion([providerId, 'FORMAT_NOT_ESTABLISHED'])
  }
}
