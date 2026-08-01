import { homedir } from 'node:os'
import path from 'node:path'
import { detectUnsupportedRoot, type DetectOptions } from '../detect-unsupported-root'

export type ClaudeCodeDetectOptions = Partial<DetectOptions>

export function detectClaudeCode(options: ClaudeCodeDetectOptions = {}) {
  return detectUnsupportedRoot({
    root: options.root ?? path.join(homedir(), '.claude', 'projects')
  })
}
