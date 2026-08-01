import { homedir } from 'node:os'
import path from 'node:path'
import { detectUnsupportedRoot, type DetectOptions } from '../detect-unsupported-root'

export interface HermesDetectOptions {
  roots?: readonly string[]
}

export async function detectHermes(options: HermesDetectOptions = {}) {
  const roots =
    options.roots ??
    [
      path.join(homedir(), '.hermes', 'sessions'),
      path.join(homedir(), '.config', 'hermes')
    ]
  const detections = await Promise.all(
    roots.map((root) => detectUnsupportedRoot({ root }))
  )
  const evidenced = detections.find(
    (detection) => detection.reason === 'FORMAT_NOT_ESTABLISHED'
  )
  if (evidenced !== undefined) return evidenced
  const inaccessible = detections.find(
    (detection) => detection.reason === 'INACCESSIBLE_ROOT'
  )
  return inaccessible ?? detections[0] ?? {
    available: false,
    reason: 'NOT_INSTALLED' as const,
    candidates: []
  }
}
