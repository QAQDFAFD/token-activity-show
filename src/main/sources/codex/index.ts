import type { SessionSource } from '../session-source'
import { detectCodex, type CodexDetectOptions } from './detect'
import { parseCodexSessions } from './parse'

export type CodexSourceOptions = CodexDetectOptions

export function createCodexSource(
  options: CodexSourceOptions = {}
): SessionSource {
  return {
    providerId: 'codex',
    detect: () => detectCodex(options),
    scan: async () => parseCodexSessions()
  }
}
