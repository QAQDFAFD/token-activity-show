import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { SessionRepository } from './db/session-repository'
import { MetricsRepository } from './db/metrics-repository'
import { SettingsRepository } from './db/settings-repository'
import { openDatabase } from './db/open-database'
import { registerIpc } from './ipc/register-ipc'
import { TodayService } from './metrics/today-service'
import { RefreshCoordinator } from './refresh/refresh-coordinator'
import { RefreshScheduler } from './refresh/refresh-scheduler'
import { secureWebPreferences } from './security/window-options'
import { createClaudeCodeSource } from './sources/claude-code'
import { createCodexSource } from './sources/codex'
import { createHermesSource } from './sources/hermes'
import { createSourceRegistry } from './sources/source-registry'
import { IPC_CHANNELS } from '../shared/api'

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 960,
    height: 720,
    show: false,
    webPreferences: secureWebPreferences(join(__dirname, '../preload/index.cjs'))
  })

  window.once('ready-to-show', () => window.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

void app.whenReady().then(() => {
  createWindow()

  const database = openDatabase(join(app.getPath('userData'), 'token-activity-show.sqlite'))
  const settings = new SettingsRepository(database)
  const sessions = new SessionRepository(database)
  const today = new TodayService({
    sessions,
    metrics: new MetricsRepository(database)
  })
  const currentTodayInput = (): { localDate: string; timeZone: string } => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
    return { localDate, timeZone }
  }
  const coordinator = new RefreshCoordinator({
    registry: createSourceRegistry([
      createClaudeCodeSource(),
      createCodexSource(),
      createHermesSource()
    ]),
    sessions,
    getSettings: () => settings.get(),
    afterSuccessfulRefresh: async () => {
      await today.get(currentTodayInput())
    }
  })
  const scheduler = new RefreshScheduler(() => coordinator.refresh('scheduled'))
  const disposeIpc = registerIpc(
    {
      getToday: (input) => today.get(input),
      refreshNow: () => coordinator.refresh('manual'),
      getSettings: async () => settings.get(),
      updateSettings: async (input) => settings.set(input)
    },
    {
      subscribeRefreshState: (listener) => coordinator.onStateChange(listener),
      broadcastRefreshState: (state) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send(IPC_CHANNELS.refreshState, state)
        }
      },
      rescheduleRefresh: (intervalMinutes) =>
        scheduler.reschedule(intervalMinutes)
    }
  )
  scheduler.start(settings.get().refreshIntervalMinutes)

  app.once('before-quit', () => {
    scheduler.stop()
    disposeIpc()
    database.close()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
