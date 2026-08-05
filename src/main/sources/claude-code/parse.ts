import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import readline from 'node:readline'
import type { NormalizedSession } from '../../../shared/domain'
import type { SourceScanResult, SourceWarning } from '../session-source'
import { contentVersion } from '../version'

const MAX_FILE_BYTES = 32 * 1024 * 1024
const MAX_LINE_BYTES = 1024 * 1024
const ALLOWED_TYPES = new Set(['assistant', 'file-history-snapshot', 'queue-operation', 'system', 'user'])

type RecordShape = Record<string, unknown>

function object(value: unknown): RecordShape | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordShape : null
}

function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  const nested = object(value)
  if (!nested) return null
  if (typeof nested.content === 'string') return nested.content.trim() || null
  return null
}

function evidencedId(record: RecordShape): string | null {
  const values = ['sessionId', 'session_id']
    .map((key) => record[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
  return values.length > 0 && values.every((value) => value === values[0]) ? values[0] : null
}

export async function parseClaudeCodeFile(filePath: string, projectName: string | null): Promise<{ session: NormalizedSession | null, warnings: SourceWarning[] }> {
  const warnings: SourceWarning[] = []
  const ids = new Set<string>()
  const timestamps: number[] = []
  const structuralHash = createHash('sha256')
  let interactions = 0
  let bytes = 0
  let lineNumber = 0

  const input = createReadStream(filePath)
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      lineNumber += 1
      bytes += Buffer.byteLength(line) + 1
      if (bytes > MAX_FILE_BYTES) { warnings.push({ code: 'FILE_LIMIT_EXCEEDED', message: 'A session file exceeded the parsing limit.' }); break }
      if (Buffer.byteLength(line) > MAX_LINE_BYTES) { warnings.push({ code: 'LINE_LIMIT_EXCEEDED', message: 'A session record exceeded the parsing limit.', record: String(lineNumber) }); continue }
      if (!line.trim()) continue
      let record: RecordShape
      try {
        const parsed = object(JSON.parse(line))
        if (!parsed) throw new Error('not an object')
        record = parsed
      } catch {
        warnings.push({ code: 'MALFORMED_RECORD', message: 'A session record could not be parsed.', record: String(lineNumber) })
        continue
      }
      if (typeof record.type !== 'string' || !ALLOWED_TYPES.has(record.type)) continue
      structuralHash.update(line).update('\n')
      const id = evidencedId(record)
      if (id) ids.add(id)
      if (typeof record.timestamp === 'string') {
        const parsed = Date.parse(record.timestamp)
        if (Number.isFinite(parsed)) timestamps.push(parsed)
      }
      const meta = record.isMeta === true || record.isCompactSummary === true || record.isSnapshotUpdate === true
      if (record.type === 'user' && !meta && (text(record.message) ?? text(record.content))) interactions += 1
    }
  } catch {
    warnings.push({ code: 'READ_ERROR', message: 'A session file could not be fully read.' })
  }

  if (timestamps.length === 0) {
    warnings.push({ code: 'NO_VALID_TIMESTAMP', message: 'A session file had no valid timestamp.' })
    return { session: null, warnings }
  }
  const stem = path.basename(filePath, '.jsonl')
  const sourceSessionId = ids.size === 1 ? [...ids][0] : stem
  const startedAt = new Date(Math.min(...timestamps)).toISOString()
  const updatedAt = new Date(Math.max(...timestamps)).toISOString()
  return {
    session: {
      id: `claude-code:${sourceSessionId}`,
      providerId: 'claude-code',
      sourceSessionId,
      startedAt,
      updatedAt,
      projectName,
      workingDirectory: null,
      model: null,
      interactionCount: interactions,
      tokenUsage: null,
      activeDurationSeconds: null,
      contentVersion: contentVersion([sourceSessionId, startedAt, updatedAt, String(interactions), structuralHash.digest('hex')])
    },
    warnings
  }
}

export async function parseClaudeCodeSessions(files: readonly string[], root: string): Promise<SourceScanResult> {
  const sessions: NormalizedSession[] = []
  const warnings: SourceWarning[] = []
  for (const file of files) {
    const relative = path.relative(root, file)
    if (relative.startsWith('..') || path.isAbsolute(relative)) continue
    const segments = relative.split(path.sep)
    const projectName = segments.length > 1 ? path.basename(path.dirname(file)) : null
    const parsed = await parseClaudeCodeFile(file, projectName)
    if (parsed.session) sessions.push(parsed.session)
    warnings.push(...parsed.warnings)
  }
  sessions.sort((a, b) => a.sourceSessionId.localeCompare(b.sourceSessionId))
  return {
    sessions,
    warnings,
    capabilities: { interactions: true, tokens: false, activeDuration: false, model: false, trustworthyQuota: false },
    fingerprint: contentVersion(sessions.map((session) => `${session.sourceSessionId}:${session.contentVersion}`))
  }
}
