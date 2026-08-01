import { homedir } from 'node:os'
import path from 'node:path'
import { detectUnsupportedRoot, type DetectOptions } from '../detect-unsupported-root'

export type CodexDetectOptions = Partial<DetectOptions>

export function detectCodex(options: CodexDetectOptions = {}) {
  return detectUnsupportedRoot({
    root: options.root ?? path.join(homedir(), '.codex', 'sessions')
  })
}
