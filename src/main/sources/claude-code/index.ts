import path from 'node:path'
import { realpath } from 'node:fs/promises'
import type { SessionSource } from '../session-source'
import { defaultClaudeCodeRoot, detectClaudeCode, type ClaudeCodeDetectOptions } from './detect'
import { parseClaudeCodeSessions } from './parse'

export type ClaudeCodeSourceOptions = ClaudeCodeDetectOptions

export function createClaudeCodeSource(options: ClaudeCodeSourceOptions = {}): SessionSource {
  const root = path.resolve(options.root ?? defaultClaudeCodeRoot())
  return {
    providerId: 'claude-code',
    detect: () => detectClaudeCode({ root }),
    scan: async () => {
      const detection = await detectClaudeCode({ root })
      if (!detection.available) {
        return {
          sessions: [], warnings: [{ code: detection.reason ?? 'FORMAT_NOT_ESTABLISHED', message: 'Claude Code session data is unavailable.' }],
          capabilities: { interactions: false, tokens: false, activeDuration: false, model: false, trustworthyQuota: false },
          fingerprint: ''
        }
      }
      return parseClaudeCodeSessions(detection.candidates.map((candidate) => candidate.path), await realpath(root))
    }
  }
}
