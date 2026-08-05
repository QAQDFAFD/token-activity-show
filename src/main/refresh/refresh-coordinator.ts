import type {
  ProviderRefreshResult,
  RefreshReport,
  RefreshState,
  RefreshTrigger
} from '../../shared/api'
import type { SourceSettings, UpsertResult } from '../../shared/domain'
import type { SessionRepository } from '../db/session-repository'
import type { SourceRegistry } from '../sources/source-registry'

export interface RefreshCoordinatorDependencies {
  registry: SourceRegistry
  sessions: Pick<SessionRepository, 'upsertMany'>
  getSettings(): SourceSettings
  afterSuccessfulRefresh?: () => Promise<void> | void
}

type RefreshStateListener = (state: RefreshState) => void

const emptyUpsertResult = (): UpsertResult => ({
  inserted: 0,
  updated: 0,
  unchanged: 0
})

export class RefreshCoordinator {
  private running = false
  private readonly listeners = new Set<RefreshStateListener>()

  constructor(private readonly dependencies: RefreshCoordinatorDependencies) {}

  onStateChange(listener: RefreshStateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async refresh(trigger: RefreshTrigger): Promise<RefreshReport> {
    if (this.running) return { status: 'skipped', reason: 'already-running' }

    this.running = true
    this.emit({ status: 'scanning' })

    try {
      const sources = this.dependencies.registry.enabled(
        this.dependencies.getSettings().enabledSources
      )
      const totals = emptyUpsertResult()
      const providerResults: ProviderRefreshResult[] = []
      let succeeded = 0
      let failed = 0
      let warnings = 0

      await Promise.all(
        sources.map(async (source) => {
          try {
            const result = await source.scan({})
            const warningCodes = result.warnings.map(({ code }) =>
              /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'UNKNOWN_WARNING'
            )
            warnings += warningCodes.length
            if (warningCodes.includes('FORMAT_NOT_ESTABLISHED')) {
              providerResults.push({ providerId: source.providerId, status: 'unsupported', ...emptyUpsertResult(), warningCodes })
              return
            }
            if (result.error !== undefined) {
              failed += 1
              providerResults.push({ providerId: source.providerId, status: 'failed', ...emptyUpsertResult(), warningCodes: [...warningCodes, result.error.code] })
              return
            }

            const upsert = this.dependencies.sessions.upsertMany(result.sessions)
            totals.inserted += upsert.inserted
            totals.updated += upsert.updated
            totals.unchanged += upsert.unchanged
            succeeded += 1
            providerResults.push({ providerId: source.providerId, status: 'succeeded', ...upsert, warningCodes })
          } catch {
            failed += 1
            providerResults.push({ providerId: source.providerId, status: 'failed', ...emptyUpsertResult(), warningCodes: [] })
          }
        })
      )

      await this.dependencies.afterSuccessfulRefresh?.()
      const report: RefreshReport = {
        status: 'complete',
        trigger,
        providers: sources.length,
        succeeded,
        failed,
        ...totals,
        warnings,
        providerResults: sources.map(({ providerId }) => providerResults.find((result) => result.providerId === providerId)!)
      }
      this.emit({ status: 'complete' })
      return report
    } catch {
      this.emit({ status: 'failed' })
      return { status: 'failed', trigger, reason: 'REFRESH_FAILED' }
    } finally {
      this.running = false
      this.emit({ status: 'idle' })
    }
  }

  private emit(state: RefreshState): void {
    for (const listener of this.listeners) listener(state)
  }
}
