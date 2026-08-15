import { homedir } from 'node:os'
import path from 'node:path'
import { detectSessionRoot } from '../collect-candidates'
import type { SourceDetection } from '../session-source'

export type CodexDetectOptions = { root?: string }

export const defaultCodexRoot = () => path.join(homedir(), '.codex', 'sessions')

export function detectCodex(options: CodexDetectOptions = {}): Promise<SourceDetection> {
  return detectSessionRoot({
    root: options.root ?? defaultCodexRoot(),
    match: (name) => (path.extname(name) === '.jsonl' ? 'jsonl' : null)
  })
}
