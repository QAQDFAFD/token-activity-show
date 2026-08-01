import type Database from 'better-sqlite3'
import { PROVIDER_IDS, type SourceSettings } from '../../shared/domain'

const SETTINGS_KEY = 'source-settings'

export const DEFAULT_SOURCE_SETTINGS: SourceSettings = {
  enabledSources: {
    'claude-code': true,
    codex: true,
    hermes: true
  },
  refreshIntervalMinutes: 10
}

export class SettingsRepository {
  private readonly getStatement: Database.Statement<
    [string],
    { value_json: string }
  >
  private readonly setStatement: Database.Statement<[string, string]>

  constructor(database: Database.Database) {
    this.getStatement = database.prepare(
      'SELECT value_json FROM settings WHERE key = ?'
    )
    this.setStatement = database.prepare(`
      INSERT INTO settings (key, value_json) VALUES (?, ?)
      ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json
    `)
  }

  get(): SourceSettings {
    const row = this.getStatement.get(SETTINGS_KEY)
    if (row === undefined) {
      return {
        enabledSources: { ...DEFAULT_SOURCE_SETTINGS.enabledSources },
        refreshIntervalMinutes: DEFAULT_SOURCE_SETTINGS.refreshIntervalMinutes
      }
    }

    const stored = JSON.parse(row.value_json) as SourceSettings
    return {
      enabledSources: Object.fromEntries(
        PROVIDER_IDS.map((providerId) => [
          providerId,
          stored.enabledSources[providerId]
        ])
      ) as SourceSettings['enabledSources'],
      refreshIntervalMinutes: stored.refreshIntervalMinutes
    }
  }

  set(settings: SourceSettings): SourceSettings {
    this.setStatement.run(SETTINGS_KEY, JSON.stringify(settings))
    return this.get()
  }
}
