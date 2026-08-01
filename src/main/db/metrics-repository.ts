import type Database from 'better-sqlite3'
import type {
  DailyMetrics,
  MetricCapabilities,
  ProviderId
} from '../../shared/domain'

interface DailyMetricsRow {
  date: string
  provider_id: ProviderId
  session_count: number
  interaction_count: number | null
  token_usage: number | null
  active_duration_seconds: number | null
  capabilities_json: string
}

function rowToMetrics(row: DailyMetricsRow): DailyMetrics {
  return {
    date: row.date,
    providerId: row.provider_id,
    sessionCount: row.session_count,
    interactionCount: row.interaction_count,
    tokenUsage: row.token_usage,
    activeDurationSeconds: row.active_duration_seconds,
    capabilities: JSON.parse(row.capabilities_json) as MetricCapabilities
  }
}

export class MetricsRepository {
  private readonly upsertStatement: Database.Statement
  private readonly getStatement: Database.Statement<
    [string, ProviderId],
    DailyMetricsRow
  >
  private readonly listStatement: Database.Statement<[string], DailyMetricsRow>
  private readonly replaceTransaction: (
    records: readonly DailyMetrics[]
  ) => void

  constructor(database: Database.Database) {
    this.upsertStatement = database.prepare(`
      INSERT INTO daily_metrics (
        date, provider_id, session_count, interaction_count, token_usage,
        active_duration_seconds, capabilities_json
      ) VALUES (
        @date, @providerId, @sessionCount, @interactionCount, @tokenUsage,
        @activeDurationSeconds, @capabilitiesJson
      )
      ON CONFLICT (date, provider_id) DO UPDATE SET
        session_count = excluded.session_count,
        interaction_count = excluded.interaction_count,
        token_usage = excluded.token_usage,
        active_duration_seconds = excluded.active_duration_seconds,
        capabilities_json = excluded.capabilities_json
    `)
    this.getStatement = database.prepare(
      'SELECT * FROM daily_metrics WHERE date = ? AND provider_id = ?'
    )
    this.listStatement = database.prepare(
      'SELECT * FROM daily_metrics WHERE date = ? ORDER BY provider_id'
    )
    this.replaceTransaction = database.transaction((records) => {
      for (const record of records) {
        this.upsertStatement.run({
          ...record,
          capabilitiesJson: JSON.stringify(record.capabilities)
        })
      }
    })
  }

  upsertMany(records: readonly DailyMetrics[]): void {
    this.replaceTransaction(records)
  }

  get(date: string, providerId: ProviderId): DailyMetrics | null {
    const row = this.getStatement.get(date, providerId)
    return row === undefined ? null : rowToMetrics(row)
  }

  listByDate(date: string): DailyMetrics[] {
    return this.listStatement.all(date).map(rowToMetrics)
  }
}
