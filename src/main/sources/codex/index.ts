import path from 'node:path'
import { realpath } from 'node:fs/promises'
import type { SessionSource } from '../session-source'
import { defaultCodexRoot, detectCodex, type CodexDetectOptions } from './detect'
import { parseCodexSessions } from './parse'

export type CodexSourceOptions = CodexDetectOptions

export function createCodexSource(options: CodexSourceOptions = {}): SessionSource {
  const root = path.resolve(options.root ?? defaultCodexRoot())
  return {
    providerId: 'codex',
    detect: () => detectCodex({ root }),
    scan: async () => {
      const detection = await detectCodex({ root })
      if (!detection.available) {
        return {
          sessions: [],
          warnings: [
            {
              code: detection.reason ?? 'FORMAT_NOT_ESTABLISHED',
              message: 'Codex session data is unavailable.'
            }
          ],
          capabilities: {
            interactions: false,
            tokens: false,
            activeDuration: false,
            model: false,
            trustworthyQuota: false
          },
          fingerprint: ''
        }
      }
      return parseCodexSessions(
        detection.candidates.map((candidate) => candidate.path),
        await realpath(root)
      )
    }
  }
}
