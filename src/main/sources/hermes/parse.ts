import { createReadStream } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import readline from 'node:readline'
import Database from 'better-sqlite3'
import type { NormalizedSession } from '../../../shared/domain'
import type { SourceScanResult, SourceWarning } from '../session-source'
import { contentVersion } from '../version'

const MAX_FILE_BYTES = 32 * 1024 * 1024
const MAX_LINE_BYTES = 1024 * 1024
const ALLOWED_ROLES = new Set(['assistant', 'session_meta', 'tool', 'user'])

type RecordShape = Record<string, unknown>

function object(value: unknown): RecordShape | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordShape)
    : null
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function iso(value: number): string {
  return new Date(value).toISOString()
}

function unixMillis(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const millis = value > 1e12 ? value : value * 1000
  return Number.isFinite(millis) ? millis : null
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

async function parseHermesJsonl(
  filePath: string,
  fallbackSourceSessionId: string
): Promise<{ session: NormalizedSession | null; warnings: SourceWarning[] }> {
  const warnings: SourceWarning[] = []
  const timestamps: number[] = []
  const interactionEvents: string[] = []
  const structuralHash = createHash('sha256')
  let interactions = 0
  let model: string | null = null
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
      if (typeof record.role !== 'string' || !ALLOWED_ROLES.has(record.role)) continue
      structuralHash.update(line).update('\n')
      const timestamp = parseTimestamp(record.timestamp)
      if (timestamp !== null) timestamps.push(timestamp)
      if (record.role === 'session_meta' && typeof record.model === 'string' && record.model.trim()) {
        model = record.model.trim()
      }
      if (record.role === 'user' && typeof record.content === 'string' && record.content.trim()) {
        interactions += 1
        if (typeof record.timestamp === 'string' && timestamp !== null) {
          interactionEvents.push(record.timestamp)
        }
      }
    }
  } catch {
    warnings.push({ code: 'READ_ERROR', message: 'A session file could not be fully read.' })
  }

  if (timestamps.length === 0) {
    warnings.push({ code: 'NO_VALID_TIMESTAMP', message: 'A session file had no valid timestamp.' })
    return { session: null, warnings }
  }
  const sourceSessionId = fallbackSourceSessionId
  const startedAt = iso(Math.min(...timestamps))
  const updatedAt = iso(Math.max(...timestamps))
  return {
    session: {
      id: `hermes:${sourceSessionId}`,
      providerId: 'hermes',
      sourceSessionId,
      startedAt,
      updatedAt,
      projectName: null,
      workingDirectory: null,
      model,
      interactionCount: interactions,
      interactionEvents: [...interactionEvents].sort(),
      tokenUsage: null,
      activeDurationSeconds: null,
      contentVersion: contentVersion([
        sourceSessionId,
        startedAt,
        updatedAt,
        String(interactions),
        ...interactionEvents,
        model ?? '',
        structuralHash.digest('hex')
      ])
    },
    warnings
  }
}

async function parseHermesJson(
  filePath: string,
  fallbackSourceSessionId: string
): Promise<{ session: NormalizedSession | null; warnings: SourceWarning[] }> {
  const warnings: SourceWarning[] = []
  let raw: string
  try {
    const info = await stat(filePath)
    if (info.size > MAX_FILE_BYTES) {
      warnings.push({ code: 'FILE_LIMIT_EXCEEDED', message: 'A session file exceeded the parsing limit.' })
      return { session: null, warnings }
    }
    raw = await readFile(filePath, 'utf8')
  } catch {
    warnings.push({ code: 'READ_ERROR', message: 'A session file could not be read.' })
    return { session: null, warnings }
  }

  let document: RecordShape
  try {
    const parsed = object(JSON.parse(raw))
    if (!parsed) throw new Error('not an object')
    document = parsed
  } catch {
    warnings.push({ code: 'MALFORMED_RECORD', message: 'A session record could not be parsed.' })
    return { session: null, warnings }
  }

  const timestamps = [document.session_start, document.last_updated]
    .map(parseTimestamp)
    .filter((value): value is number => value !== null)
  if (timestamps.length === 0) {
    warnings.push({ code: 'NO_VALID_TIMESTAMP', message: 'A session file had no valid timestamp.' })
    return { session: null, warnings }
  }

  const messages = Array.isArray(document.messages) ? document.messages : []
  let interactions = 0
  for (const item of messages) {
    const message = object(item)
    if (
      message !== null &&
      message.role === 'user' &&
      typeof message.content === 'string' &&
      message.content.trim()
    ) {
      interactions += 1
    }
  }

  const sourceSessionId =
    typeof document.session_id === 'string' && document.session_id.trim()
      ? document.session_id.trim()
      : fallbackSourceSessionId
  const startedAt = iso(Math.min(...timestamps))
  const updatedAt = iso(Math.max(...timestamps))
  const model =
    typeof document.model === 'string' && document.model.trim() ? document.model.trim() : null
  const structuralHash = createHash('sha256').update(raw).digest('hex')
  return {
    session: {
      id: `hermes:${sourceSessionId}`,
      providerId: 'hermes',
      sourceSessionId,
      startedAt,
      updatedAt,
      projectName: null,
      workingDirectory: null,
      model,
      interactionCount: interactions,
      interactionEvents: [],
      tokenUsage: null,
      activeDurationSeconds: null,
      contentVersion: contentVersion([
        sourceSessionId,
        startedAt,
        updatedAt,
        String(interactions),
        model ?? '',
        structuralHash
      ])
    },
    warnings
  }
}

interface HermesDatabaseSessionRow {
  id: string
  model: string | null
  started_at: number | null
  ended_at: number | null
  input_tokens: number | null
  output_tokens: number | null
  cache_read_tokens: number | null
  cache_write_tokens: number | null
  reasoning_tokens: number | null
}

interface HermesDatabaseEventRow {
  session_id: string
  timestamp: number | null
}

export function parseHermesDatabase(databasePath: string): SourceScanResult {
  const warnings: SourceWarning[] = []
  let database: Database.Database
  try {
    database = new Database(databasePath, { readonly: true, fileMustExist: true })
    database.pragma('busy_timeout = 5000')
  } catch {
    return {
      sessions: [],
      warnings: [{ code: 'READ_ERROR', message: 'A session file could not be read.' }],
      capabilities: {
        interactions: false,
        tokens: false,
        activeDuration: false,
        model: false,
        trustworthyQuota: false
      },
      fingerprint: ''
    }
  }

  try {
    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('sessions', 'messages')"
      )
      .all() as Array<{ name: string }>
    const names = new Set(tables.map((table) => table.name))
    if (!names.has('sessions') || !names.has('messages')) {
      return {
        sessions: [],
        warnings: [
          {
            code: 'FORMAT_NOT_ESTABLISHED',
            message: 'No evidenced local session format is established for hermes.'
          }
        ],
        capabilities: {
          interactions: false,
          tokens: false,
          activeDuration: false,
          model: false,
          trustworthyQuota: false
        },
        fingerprint: contentVersion(['hermes', 'FORMAT_NOT_ESTABLISHED'])
      }
    }

    const rows = database
      .prepare(
        `SELECT id, model, started_at, ended_at, input_tokens, output_tokens,
                cache_read_tokens, cache_write_tokens, reasoning_tokens
         FROM sessions`
      )
      .all() as HermesDatabaseSessionRow[]
    const events = database
      .prepare(
        `SELECT session_id, timestamp
         FROM messages
         WHERE role = 'user'
           AND content IS NOT NULL
           AND length(trim(content)) > 0`
      )
      .all() as HermesDatabaseEventRow[]

    const eventsBySession = new Map<string, string[]>()
    for (const event of events) {
      const at = unixMillis(event.timestamp)
      if (at === null || typeof event.session_id !== 'string' || !event.session_id.trim()) continue
      const list = eventsBySession.get(event.session_id) ?? []
      list.push(iso(at))
      eventsBySession.set(event.session_id, list)
    }

    const sessions: NormalizedSession[] = []
    for (const row of rows) {
      if (typeof row.id !== 'string' || !row.id.trim()) continue
      const sourceSessionId = row.id.trim()
      const started = unixMillis(row.started_at)
      const interactionEvents = [...(eventsBySession.get(sourceSessionId) ?? [])].sort()
      const eventTimes = interactionEvents.map((value) => Date.parse(value)).filter(Number.isFinite)
      const updated = unixMillis(row.ended_at)
      const timestamps = [started, updated, ...eventTimes].filter(
        (value): value is number => value !== null && Number.isFinite(value)
      )
      if (timestamps.length === 0) {
        warnings.push({
          code: 'NO_VALID_TIMESTAMP',
          message: 'A session file had no valid timestamp.'
        })
        continue
      }
      const startedAt = iso(Math.min(...timestamps))
      const updatedAt = iso(Math.max(...timestamps))
      const model = typeof row.model === 'string' && row.model.trim() ? row.model.trim() : null
      const tokenUsage =
        numeric(row.input_tokens) +
        numeric(row.output_tokens) +
        numeric(row.cache_read_tokens) +
        numeric(row.cache_write_tokens) +
        numeric(row.reasoning_tokens)
      sessions.push({
        id: `hermes:${sourceSessionId}`,
        providerId: 'hermes',
        sourceSessionId,
        startedAt,
        updatedAt,
        projectName: null,
        workingDirectory: null,
        model,
        interactionCount: interactionEvents.length,
        interactionEvents,
        tokenUsage,
        activeDurationSeconds: null,
        contentVersion: contentVersion([
          sourceSessionId,
          startedAt,
          updatedAt,
          String(interactionEvents.length),
          ...interactionEvents,
          model ?? '',
          String(tokenUsage)
        ])
      })
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
  } catch {
    return {
      sessions: [],
      warnings: [{ code: 'READ_ERROR', message: 'A session file could not be fully read.' }],
      capabilities: {
        interactions: false,
        tokens: false,
        activeDuration: false,
        model: false,
        trustworthyQuota: false
      },
      fingerprint: ''
    }
  } finally {
    database.close()
  }
}

export async function parseHermesSessions(
  files: readonly string[],
  roots: readonly string[]
): Promise<SourceScanResult> {
  const sessions: NormalizedSession[] = []
  const warnings: SourceWarning[] = []
  const resolvedRoots: string[] = []
  for (const root of roots) {
    try {
      resolvedRoots.push(await realpath(root))
    } catch {
      // A missing optional root is not an error when another root has evidence.
    }
  }

  for (const file of files) {
    let canonicalFile: string
    try {
      canonicalFile = await realpath(file)
    } catch {
      warnings.push({ code: 'READ_ERROR', message: 'A session file could not be read.' })
      continue
    }
    const containingRoot = resolvedRoots.find((root) => {
      const relative = path.relative(root, canonicalFile)
      return !relative.startsWith('..') && !path.isAbsolute(relative)
    })
    if (containingRoot === undefined) {
      warnings.push({
        code: 'OUTSIDE_ROOT',
        message: 'A session file resolved outside the configured root.'
      })
      continue
    }
    const relative = path.relative(containingRoot, canonicalFile)
    const fallbackSourceSessionId = createHash('sha256').update(relative).digest('hex')
    const extension = path.extname(canonicalFile)
    const parsed =
      extension === '.json'
        ? await parseHermesJson(canonicalFile, fallbackSourceSessionId)
        : await parseHermesJsonl(
            canonicalFile,
            path.basename(canonicalFile, extension) || fallbackSourceSessionId
          )
    if (parsed.session) sessions.push(parsed.session)
    warnings.push(...parsed.warnings)
  }
  sessions.sort((a, b) => a.sourceSessionId.localeCompare(b.sourceSessionId))
  return {
    sessions,
    warnings,
    capabilities: {
      interactions: true,
      tokens: false,
      activeDuration: false,
      model: true,
      trustworthyQuota: false
    },
    fingerprint: contentVersion(
      sessions.map((session) => `${session.sourceSessionId}:${session.contentVersion}`)
    )
  }
}
