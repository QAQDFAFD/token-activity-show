import { opendir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { SourceDetection, SourceDetectionCandidate } from '../session-source'

export interface ClaudeCodeDetectOptions { root?: string }

export const defaultClaudeCodeRoot = () => path.join(process.env.HOME ?? '', '.claude', 'projects')

const MAX_SESSION_FILES = 10_000

async function collect(root: string, current: string, candidates: SourceDetectionCandidate[]): Promise<void> {
  if (candidates.length >= MAX_SESSION_FILES) return
  const entries = await opendir(current)
  for await (const entry of entries) {
    if (candidates.length >= MAX_SESSION_FILES) break
    const candidate = path.join(current, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) await collect(root, candidate, candidates)
    else if (entry.isFile() && path.extname(entry.name) === '.jsonl') {
      const canonical = await realpath(candidate)
      if (canonical.startsWith(`${root}${path.sep}`)) candidates.push({ path: candidate, kind: 'jsonl' })
    }
  }
}

export async function detectClaudeCode(options: ClaudeCodeDetectOptions = {}): Promise<SourceDetection> {
  const configured = path.resolve(options.root ?? defaultClaudeCodeRoot())
  try {
    const canonical = await realpath(configured)
    if (!(await stat(canonical)).isDirectory()) return { available: false, reason: 'NOT_INSTALLED', candidates: [] }
    const candidates: SourceDetectionCandidate[] = []
    await collect(canonical, canonical, candidates)
    candidates.sort((a, b) => a.path.localeCompare(b.path))
    return candidates.length > 0
      ? { available: true, candidates }
      : { available: false, reason: 'FORMAT_NOT_ESTABLISHED', candidates: [] }
  } catch {
    return { available: false, reason: 'NOT_INSTALLED', candidates: [] }
  }
}
