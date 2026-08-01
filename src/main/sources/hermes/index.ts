import type { SessionSource } from '../session-source'
import { detectHermes, type HermesDetectOptions } from './detect'
import { parseHermesSessions } from './parse'

export type HermesSourceOptions = HermesDetectOptions

export function createHermesSource(
  options: HermesSourceOptions = {}
): SessionSource {
  return {
    providerId: 'hermes',
    detect: () => detectHermes(options),
    scan: async () => parseHermesSessions()
  }
}
