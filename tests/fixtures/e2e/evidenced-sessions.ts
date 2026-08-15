import type { NormalizedSession } from '../../../src/shared/domain'
import type { SessionSource } from '../../../src/main/sources/session-source'

export const RAW_BODY_MUST_NOT_BE_STORED = 'RAW_BODY_MUST_NOT_BE_STORED'

const sessions: NormalizedSession[] = [
  {
    id: 'claude-code:evidenced-one',
    providerId: 'claude-code',
    sourceSessionId: 'evidenced-one',
    startedAt: '2026-08-02T09:00:00.000Z',
    updatedAt: '2026-08-02T09:05:00.000Z',
    projectName: 'sample-project',
    workingDirectory: null,
    model: null,
    interactionCount: 3,
    interactionEvents: ['2026-08-02T09:01:00.000Z', '2026-08-02T09:02:00.000Z', '2026-08-02T09:03:00.000Z'],
    tokenUsage: null,
    activeDurationSeconds: null,
    contentVersion: 'evidenced-v1-one'
  },
  {
    id: 'claude-code:evidenced-two',
    providerId: 'claude-code',
    sourceSessionId: 'evidenced-two',
    startedAt: '2026-08-02T10:00:00.000Z',
    updatedAt: '2026-08-02T10:10:00.000Z',
    projectName: 'sample-project',
    workingDirectory: null,
    model: null,
    interactionCount: 4,
    interactionEvents: ['2026-08-02T10:01:00.000Z', '2026-08-02T10:02:00.000Z', '2026-08-02T10:03:00.000Z', '2026-08-02T10:04:00.000Z'],
    tokenUsage: null,
    activeDurationSeconds: null,
    contentVersion: 'evidenced-v1-two'
  }
]

export const evidencedSessionSource: SessionSource = {
  providerId: 'claude-code',
  async detect() {
    return { available: true, candidates: [] }
  },
  async scan() {
    return {
      sessions,
      warnings: [],
      capabilities: {
        interactions: true,
        tokens: false,
        activeDuration: false,
        model: false,
        trustworthyQuota: false
      },
      fingerprint: 'evidenced-sessions-v1'
    }
  }
}
