import type { SessionSource } from '../session-source'
import { detectClaudeCode, type ClaudeCodeDetectOptions } from './detect'
import { parseClaudeCodeSessions } from './parse'

export type ClaudeCodeSourceOptions = ClaudeCodeDetectOptions

export function createClaudeCodeSource(
  options: ClaudeCodeSourceOptions = {}
): SessionSource {
  return {
    providerId: 'claude-code',
    detect: () => detectClaudeCode(options),
    scan: async () => parseClaudeCodeSessions()
  }
}
