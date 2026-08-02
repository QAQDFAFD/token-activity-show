import { join } from 'node:path'
import { app } from 'electron'
import { MetricsRepository } from './db/metrics-repository'
import { openDatabase } from './db/open-database'
import { SessionRepository } from './db/session-repository'
import { SettingsRepository } from './db/settings-repository'
import { registerIpc } from './ipc/register-ipc'
import { TodayService } from './metrics/today-service'
import { RefreshCoordinator } from './refresh/refresh-coordinator'
import { RefreshScheduler } from './refresh/refresh-scheduler'
import { createClaudeCodeSource } from './sources/claude-code'
import { createCodexSource } from './sources/codex'
import { createHermesSource } from './sources/hermes'
import { createSourceRegistry } from './sources/source-registry'
import { createTrayController } from './tray'
import { createWindowController } from './windows'
import { IPC_CHANNELS } from '../shared/api'

export interface TokenActivityShowApplication {
  start(): void
  activate(): void
  dispose(): void
}

function currentTodayInput(): { localDate: string; timeZone: string } {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return { localDate, timeZone }
}

export function createApplication(): TokenActivityShowApplication {
  const database = openDatabase(join(app.getPath('userData'), 'token-activity-show.sqlite'))
  const settings = new SettingsRepository(database)
  const sessions = new SessionRepository(database)
  const today = new TodayService({ sessions, metrics: new MetricsRepository(database) })
  const windows = createWindowController()
  const coordinator = new RefreshCoordinator({
    registry: createSourceRegistry([createClaudeCodeSource(), createCodexSource(), createHermesSource()]),
    sessions,
    getSettings: () => settings.get(),
    afterSuccessfulRefresh: async () => { await today.get(currentTodayInput()) }
  })
  const scheduler = new RefreshScheduler(() => coordinator.refresh('scheduled'))
  const tray = createTrayController({ onToggle: (bounds) => windows.toggleMenuBar(bounds), onOpenClient: () => windows.showClient(), onQuit: () => app.quit() })
  const disposeIpc = registerIpc({
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
