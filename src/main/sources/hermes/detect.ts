import { homedir } from 'node:os'
import { lstat } from 'node:fs/promises'
import path from 'node:path'
import { detectSessionRoot } from '../collect-candidates'
import type { SourceDetection, SourceDetectionCandidate } from '../session-source'

export interface HermesDetectOptions {
  roots?: readonly string[]
  databasePath?: string
}

export const defaultHermesRoots = () => [
  path.join(homedir(), '.hermes', 'sessions'),
  path.join(homedir(), '.config', 'hermes')
]

export const defaultHermesDatabase = () => path.join(homedir(), '.hermes', 'state.db')

function matchHermesFile(name: string): SourceDetectionCandidate['kind'] | null {
  if (name.startsWith('request_dump_')) return null
  const extension = path.extname(name)
  if (extension === '.jsonl') return 'jsonl'
  if (extension === '.json' && name.startsWith('session_')) return 'json'
  return null
}

export async function detectHermesDatabase(databasePath: string): Promise<SourceDetection> {
  try {
    const info = await lstat(databasePath)
    if (info.isSymbolicLink() || !info.isFile()) {
      return { available: false, reason: 'INACCESSIBLE_ROOT', candidates: [] }
    }
    return {
      available: true,
      candidates: [{ path: path.resolve(databasePath), kind: 'sqlite' }]
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return {
      available: false,
      reason: code === 'ENOENT' ? 'NOT_INSTALLED' : 'INACCESSIBLE_ROOT',
      candidates: []
    }
  }
}

export async function detectHermes(options: HermesDetectOptions = {}): Promise<SourceDetection> {
  const useDefaults = options.roots === undefined && options.databasePath === undefined
  const databasePath =
    options.databasePath ?? (useDefaults ? defaultHermesDatabase() : undefined)
  if (databasePath !== undefined) {
    const database = await detectHermesDatabase(databasePath)
    if (database.available) return database
    if (options.roots === undefined && !useDefaults) return database
  }

  const roots = options.roots ?? defaultHermesRoots()
  const detections = await Promise.all(
    roots.map((root) => detectSessionRoot({ root, match: matchHermesFile }))
  )
  const available = detections.filter((detection) => detection.available)
  if (available.length > 0) {
    const candidates = available.flatMap((detection) => detection.candidates)
    candidates.sort((left, right) => left.path.localeCompare(right.path))
    return { available: true, candidates }
  }
  const established = detections.find(
    (detection) => detection.reason === 'FORMAT_NOT_ESTABLISHED'
  )
  return established ?? detections[0] ?? {
    available: false,
    reason: 'NOT_INSTALLED',
    candidates: []
  }
}
