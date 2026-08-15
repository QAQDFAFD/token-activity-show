import type { SessionSource } from '../session-source'
import { defaultHermesRoots, detectHermes, type HermesDetectOptions } from './detect'
import { parseHermesDatabase, parseHermesSessions } from './parse'

export type HermesSourceOptions = HermesDetectOptions

export function createHermesSource(options: HermesSourceOptions = {}): SessionSource {
  return {
    providerId: 'hermes',
    detect: () => detectHermes(options),
    scan: async () => {
      const detection = await detectHermes(options)
      if (!detection.available) {
        return {
          sessions: [],
          warnings: [
            {
              code: detection.reason ?? 'FORMAT_NOT_ESTABLISHED',
              message: 'Hermes session data is unavailable.'
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
      const sqlite = detection.candidates.find((candidate) => candidate.kind === 'sqlite')
      if (sqlite !== undefined) return parseHermesDatabase(sqlite.path)
      return parseHermesSessions(
        detection.candidates.map((candidate) => candidate.path),
        options.roots ?? defaultHermesRoots()
      )
    }
  }
}
