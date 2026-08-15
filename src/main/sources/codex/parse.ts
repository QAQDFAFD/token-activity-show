import { createReadStream } from 'node:fs'
import { realpath } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import readline from 'node:readline'
import type { NormalizedSession } from '../../../shared/domain'
import type { SourceScanResult, SourceWarning } from '../session-source'
import { contentVersion } from '../version'

const MAX_FILE_BYTES = 32 * 1024 * 1024
const MAX_LINE_BYTES = 1024 * 1024
const ALLOWED_TYPES = new Set(['event_msg', 'response_item', 'session_meta', 'turn_context'])

type RecordShape = Record<string, unknown>

function object(value: unknown): RecordShape | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordShape)
    : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function hasUserRequest(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  return content.some((item) => {
    const entry = object(item)
    if (entry === null || entry.type !== 'input_text' || typeof entry.text !== 'string') {
      return false
    }
    const text = entry.text.trim()
    return text.length > 0 && !text.startsWith('<environment')
  })
}

export async function parseCodexFile(
  filePath: string,
  projectName: string | null,
  fallbackSourceSessionId: string
): Promise<{ session: NormalizedSession | null; warnings: SourceWarning[] }> {
  const warnings: SourceWarning[] = []
  const ids = new Set<string>()
  const timestamps: number[] = []
  const interactionEvents: string[] = []
  const structuralHash = createHash('sha256')
  let interactions = 0
  let tokenUsage: number | null = null
  let model: string | null = null
  let cwdName: string | null = projectName
  let bytes = 0
  let lineNumber = 0

  const input = createReadStream(filePath)
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      lineNumber += 1
      bytes += Buffer.byteLength(line) + 1
      if (bytes > MAX_FILE_BYTES) {
        warnings.push({ code: 'FILE_LIMIT_EXCEEDED', message: 'A session file exceeded the parsing limit.' })
        break
      }
      if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
        warnings.push({
          code: 'LINE_LIMIT_EXCEEDED',
          message: 'A session record exceeded the parsing limit.',
          record: String(lineNumber)
        })
        continue
      }
      if (!line.trim()) continue
      let record: RecordShape
      try {
        const parsed = object(JSON.parse(line))
        if (!parsed) throw new Error('not an object')
        record = parsed
      } catch {
        warnings.push({
          code: 'MALFORMED_RECORD',
          message: 'A session record could not be parsed.',
          record: String(lineNumber)
        })
        continue
      }
      if (typeof record.type !== 'string' || !ALLOWED_TYPES.has(record.type)) continue
      structuralHash.update(line).update('\n')
      if (typeof record.timestamp === 'string') {
        const parsed = Date.parse(record.timestamp)
        if (Number.isFinite(parsed)) timestamps.push(parsed)
      }
      const payload = object(record.payload)
      if (payload === null) continue
      if (record.type === 'session_meta' && typeof payload.id === 'string' && payload.id.trim()) {
        ids.add(payload.id.trim())
        if (cwdName === null && typeof payload.cwd === 'string' && payload.cwd.trim()) {
          cwdName = path.basename(payload.cwd)
        }
      }
      if (
        record.type === 'response_item' &&
        payload.type === 'message' &&
        payload.role === 'user' &&
        hasUserRequest(payload.content) &&
        typeof record.timestamp === 'string' &&
        Number.isFinite(Date.parse(record.timestamp))
      ) {
        interactions += 1
        interactionEvents.push(record.timestamp)
      }
      if (record.type === 'turn_context' && typeof payload.model === 'string' && payload.model.trim()) {
        model = payload.model.trim()
      }
      if (record.type === 'event_msg' && payload.type === 'token_count') {
        const info = object(payload.info)
        const total = object(info?.total_token_usage)
        const next = finiteNumber(total?.total_tokens)
        if (next !== null) tokenUsage = next
      }
    }
  } catch {
    warnings.push({ code: 'READ_ERROR', message: 'A session file could not be fully read.' })
  }

  if (timestamps.length === 0) {
    warnings.push({ code: 'NO_VALID_TIMESTAMP', message: 'A session file had no valid timestamp.' })
    return { session: null, warnings }
  }
  const stem = path.basename(filePath, '.jsonl')
  const onlyId = ids.size === 1 ? ids.values().next().value : undefined
  const sourceSessionId = onlyId ?? fallbackSourceSessionId ?? stem
  const startedAt = new Date(Math.min(...timestamps)).toISOString()
  const updatedAt = new Date(Math.max(...timestamps)).toISOString()
  return {
    session: {
      id: `codex:${sourceSessionId}`,
      providerId: 'codex',
      sourceSessionId,
      startedAt,
      updatedAt,
      projectName: cwdName,
      workingDirectory: null,
      model,
      interactionCount: interactions,
      interactionEvents: [...interactionEvents].sort(),
      tokenUsage,
      activeDurationSeconds: null,
      contentVersion: contentVersion([
        sourceSessionId,
        startedAt,
        updatedAt,
        String(interactions),
        ...interactionEvents,
        model ?? '',
        tokenUsage === null ? '' : String(tokenUsage),
        structuralHash.digest('hex')
      ])
    },
    warnings
  }
}

export async function parseCodexSessions(
  files: readonly string[],
  root: string
): Promise<SourceScanResult> {
  const sessions: NormalizedSession[] = []
  const warnings: SourceWarning[] = []
  for (const file of files) {
    let canonicalFile: string
    try {
      canonicalFile = await realpath(file)
    } catch {
      warnings.push({ code: 'READ_ERROR', message: 'A session file could not be read.' })
      continue
    }
    const relative = path.relative(root, canonicalFile)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      warnings.push({
        code: 'OUTSIDE_ROOT',
        message: 'A session file resolved outside the configured root.'
      })
      continue
    }
    const fallbackSourceSessionId = createHash('sha256').update(relative).digest('hex')
    const parsed = await parseCodexFile(canonicalFile, null, fallbackSourceSessionId)
    if (parsed.session) sessions.push(parsed.session)
    warnings.push(...parsed.warnings)
  }
  sessions.sort((a, b) => a.sourceSessionId.localeCompare(b.sourceSessionId))
  return {
    sessions,
    warnings,
    capabilities: {
      interactions: true,
      tokens: true,
      activeDuration: false,
      model: true,
      trustworthyQuota: false
    },
    fingerprint: contentVersion(
      sessions.map((session) => `${session.sourceSessionId}:${session.contentVersion}`)
    )
  }
}
