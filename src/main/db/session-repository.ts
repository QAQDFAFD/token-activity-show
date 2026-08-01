import type Database from 'better-sqlite3'
import type {
  NormalizedSession,
  ProviderId,
  UpsertResult
} from '../../shared/domain'

interface SessionRow {
  id: string
  provider_id: ProviderId
  source_session_id: string
  started_at: string
  updated_at: string
  project_name: string | null
  working_directory: string | null
  model: string | null
  interaction_count: number | null
  token_usage: number | null
  active_duration_seconds: number | null
  content_version: string
}

const UTC_DATE_START = 'T00:00:00.000Z'

function rowToSession(row: SessionRow): NormalizedSession {
  return {
    id: row.id,
    providerId: row.provider_id,
    sourceSessionId: row.source_session_id,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    projectName: row.project_name,
    workingDirectory: row.working_directory,
    model: row.model,
    interactionCount: row.interaction_count,
    tokenUsage: row.token_usage,
    activeDurationSeconds: row.active_duration_seconds,
    contentVersion: row.content_version
  }
}

function localDate(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(instant))
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  )
  return `${values.year}-${values.month}-${values.day}`
}

export class SessionRepository {
  private readonly selectContentVersion: Database.Statement<
    [string],
    { content_version: string }
  >
  private readonly insert: Database.Statement
  private readonly update: Database.Statement
  private readonly listCandidates: Database.Statement<
    [string, string],
    SessionRow
  >
  private readonly upsertTransaction: (
    sessions: readonly NormalizedSession[]
  ) => UpsertResult

  constructor(private readonly database: Database.Database) {
    this.selectContentVersion = database.prepare(
      'SELECT content_version FROM sessions WHERE id = ?'
    )
    this.insert = database.prepare(`
      INSERT INTO sessions (
        id, provider_id, source_session_id, started_at, updated_at, project_name,
        working_directory, model, interaction_count, token_usage,
        active_duration_seconds, content_version
      ) VALUES (
        @id, @providerId, @sourceSessionId, @startedAt, @updatedAt, @projectName,
        @workingDirectory, @model, @interactionCount, @tokenUsage,
        @activeDurationSeconds, @contentVersion
      )
    `)
    this.update = database.prepare(`
      UPDATE sessions SET
        provider_id = @providerId,
        source_session_id = @sourceSessionId,
        started_at = @startedAt,
        updated_at = @updatedAt,
        project_name = @projectName,
        working_directory = @workingDirectory,
        model = @model,
        interaction_count = @interactionCount,
        token_usage = @tokenUsage,
        active_duration_seconds = @activeDurationSeconds,
        content_version = @contentVersion
      WHERE id = @id
    `)
    this.listCandidates = database.prepare(`
      SELECT * FROM sessions
      WHERE started_at >= ? AND started_at < ?
      ORDER BY started_at ASC, id ASC
    `)
    this.upsertTransaction = database.transaction((sessions) => {
      const result: UpsertResult = { inserted: 0, updated: 0, unchanged: 0 }
      for (const session of sessions) {
        const existing = this.selectContentVersion.get(session.id)
        if (existing === undefined) {
          this.insert.run(session)
          result.inserted += 1
        } else if (existing.content_version === session.contentVersion) {
          result.unchanged += 1
        } else {
          this.update.run(session)
          result.updated += 1
        }
      }
      return result
    })
  }

  upsertMany(sessions: readonly NormalizedSession[]): UpsertResult {
    return this.upsertTransaction(sessions)
  }

  listByLocalDate(date: string, timeZone: string): NormalizedSession[] {
    const target = new Date(`${date}${UTC_DATE_START}`)
    const previous = new Date(target)
    previous.setUTCDate(previous.getUTCDate() - 1)
    const next = new Date(target)
    next.setUTCDate(next.getUTCDate() + 2)

    return this.listCandidates
      .all(previous.toISOString(), next.toISOString())
      .filter((row) => localDate(row.started_at, timeZone) === date)
      .map(rowToSession)
  }
}
