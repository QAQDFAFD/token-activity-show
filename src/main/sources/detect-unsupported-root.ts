import { access, lstat, realpath } from 'node:fs/promises'
import path from 'node:path'
import type { SourceDetection } from './session-source'

export interface DetectOptions {
  root: string
}

export async function detectUnsupportedRoot(
  options: DetectOptions
): Promise<SourceDetection> {
  const root = path.resolve(options.root)

  try {
    await access(root)
    const rootInfo = await lstat(root)
    if (rootInfo.isSymbolicLink()) {
      return { available: false, reason: 'INACCESSIBLE_ROOT', candidates: [] }
    }

    const resolvedRoot = await realpath(root)
    const marker = path.join(resolvedRoot, 'unsupported.json')
    const resolvedMarker = await realpath(marker)
    const relative = path.relative(resolvedRoot, resolvedMarker)

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return { available: false, reason: 'INACCESSIBLE_ROOT', candidates: [] }
    }

    const markerInfo = await lstat(marker)
    if (markerInfo.isSymbolicLink() || !markerInfo.isFile()) {
      return { available: false, reason: 'INACCESSIBLE_ROOT', candidates: [] }
    }

    return {
      available: false,
      reason: 'FORMAT_NOT_ESTABLISHED',
      candidates: [{ path: marker, kind: 'json' }]
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
