import type {
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
      let succeeded = 0
      let failed = 0
      let warnings = 0

      await Promise.all(
        sources.map(async (source) => {
          try {
            const result = await source.scan({})
            warnings += result.warnings.length
            if (result.error !== undefined) {
              failed += 1
              return
            }

            const upsert = this.dependencies.sessions.upsertMany(result.sessions)
            totals.inserted += upsert.inserted
            totals.updated += upsert.updated
            totals.unchanged += upsert.unchanged
            succeeded += 1
          } catch {
            failed += 1
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
        warnings
      }
      this.emit({ status: 'complete' })
      return report
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Refresh failed'
      this.emit({ status: 'failed', message: reason })
      return { status: 'failed', trigger, reason }
    } finally {
      this.running = false
      this.emit({ status: 'idle' })
    }
  }

  private emit(state: RefreshState): void {
    for (const listener of this.listeners) listener(state)
  }
}
