import { join } from 'node:path'
import { app } from 'electron'
import { MetricsRepository } from './db/metrics-repository'
import { openDatabase } from './db/open-database'
import { SessionRepository } from './db/session-repository'
import { SettingsRepository } from './db/settings-repository'
import { registerIpc, type IpcRegistrationOptions, type IpcServices } from './ipc/register-ipc'
import { TodayService, type TodayServiceDependencies } from './metrics/today-service'
import { RefreshCoordinator, type RefreshCoordinatorDependencies } from './refresh/refresh-coordinator'
import { RefreshScheduler } from './refresh/refresh-scheduler'
import { createClaudeCodeSource } from './sources/claude-code'
import { createCodexSource } from './sources/codex'
import { createHermesSource } from './sources/hermes'
import type { SessionSource } from './sources/session-source'
import { createSourceRegistry } from './sources/source-registry'
import { createTrayController, type TrayController } from './tray'
import { createWindowController, type WindowController } from './windows'
import { IPC_CHANNELS } from '../shared/api'

export interface TokenActivityShowApplication {
  start(): void
  activate(): void
  dispose(): void
}

type Database = ReturnType<typeof openDatabase>
type Scheduler = Pick<RefreshScheduler, 'start' | 'reschedule' | 'stop'>
type Coordinator = Pick<RefreshCoordinator, 'refresh' | 'onStateChange'>

export interface ApplicationDependencies {
  databasePath: string
  sources: SessionSource[]
  openDatabase(path: string): Database
  createWindowController(): WindowController
  createTrayController(options: Parameters<typeof createTrayController>[0]): TrayController
  createTodayService(dependencies: TodayServiceDependencies): TodayService
  createRefreshCoordinator(dependencies: RefreshCoordinatorDependencies): Coordinator
  createRefreshScheduler(refresh: () => Promise<unknown>): Scheduler
  registerIpc(services: IpcServices, options: IpcRegistrationOptions): () => void
  currentTodayInput(): { localDate: string; timeZone: string }
}

function currentTodayInput(): { localDate: string; timeZone: string } {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return { localDate, timeZone }
}

function resolveDependencies(overrides: Partial<ApplicationDependencies>): ApplicationDependencies {
  return {
    databasePath: overrides.databasePath ?? join(app.getPath('userData'), 'token-activity-show.sqlite'),
    sources: overrides.sources ?? [createClaudeCodeSource(), createCodexSource(), createHermesSource()],
    openDatabase: overrides.openDatabase ?? openDatabase,
    createWindowController: overrides.createWindowController ?? createWindowController,
    createTrayController: overrides.createTrayController ?? createTrayController,
    createTodayService: overrides.createTodayService ?? ((dependencies) => new TodayService(dependencies)),
    createRefreshCoordinator: overrides.createRefreshCoordinator ?? ((dependencies) => new RefreshCoordinator(dependencies)),
    createRefreshScheduler: overrides.createRefreshScheduler ?? ((refresh) => new RefreshScheduler(refresh)),
    registerIpc: overrides.registerIpc ?? registerIpc,
    currentTodayInput: overrides.currentTodayInput ?? currentTodayInput
  }
}

export function createApplication(overrides: Partial<ApplicationDependencies> = {}): TokenActivityShowApplication {
  const dependencies = resolveDependencies(overrides)
  const database = dependencies.openDatabase(dependencies.databasePath)
  const settings = new SettingsRepository(database)
  const sessions = new SessionRepository(database)
  const today = dependencies.createTodayService({ sessions, metrics: new MetricsRepository(database) })
  const windows = dependencies.createWindowController()
  const coordinator = dependencies.createRefreshCoordinator({
    registry: createSourceRegistry(dependencies.sources),
    sessions,
    getSettings: () => settings.get(),
    afterSuccessfulRefresh: async () => { await today.get(dependencies.currentTodayInput()) }
  })
  const scheduler = dependencies.createRefreshScheduler(() => coordinator.refresh('scheduled'))
  const tray = dependencies.createTrayController({ onToggle: (bounds) => windows.toggleMenuBar(bounds), onOpenClient: () => windows.showClient(), onQuit: () => app.quit() })
  const disposeIpc = dependencies.registerIpc({
    getToday: (input) => today.get(input),
    refreshNow: () => coordinator.refresh('manual'),
    getSettings: async () => settings.get(),
    updateSettings: async (input) => settings.set(input),
    openClient: async () => { windows.showClient(); windows.hideMenuBar() }
  }, {
    subscribeRefreshState: (listener) => coordinator.onStateChange(listener),
    broadcastRefreshState: (state) => windows.broadcast(IPC_CHANNELS.refreshState, state),
    rescheduleRefresh: (minutes) => scheduler.reschedule(minutes)
  })
  let started = false
  let disposed = false
  return {
    start: () => {
      if (started || disposed) return
      started = true
      tray.create()
      windows.showClient()
      scheduler.start(settings.get().refreshIntervalMinutes)
      void coordinator.refresh('scheduled')
    },
    activate: () => { if (!disposed) windows.showClient() },
    dispose: () => {
      if (disposed) return
      disposed = true
      scheduler.stop()
      disposeIpc()
      tray.dispose()
      windows.dispose()
      database.close()
    }
  }
}
