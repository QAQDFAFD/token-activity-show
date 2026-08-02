import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionSource } from '../../../src/main/sources/session-source'
import type { RefreshCoordinator } from '../../../src/main/refresh/refresh-coordinator'
import { TodayService } from '../../../src/main/metrics/today-service'
import { openDatabase } from '../../../src/main/db/open-database'
import { createApplication, type ApplicationDependencies } from '../../../src/main/application'

const temporaryDirectories: string[] = []
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function harness(overrides: Partial<ApplicationDependencies> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'token-show-application-'))
  temporaryDirectories.push(directory)
  const events: string[] = []
  const refresh = vi.fn(async () => ({ status: 'complete' as const, trigger: 'scheduled' as const, providers: 0, succeeded: 0, failed: 0, inserted: 0, updated: 0, unchanged: 0, warnings: 0 }))
  const coordinator = { refresh, onStateChange: vi.fn(() => vi.fn()) } as unknown as RefreshCoordinator
  const scheduler = { start: vi.fn(() => events.push('scheduler.start')), reschedule: vi.fn(), stop: vi.fn(() => events.push('scheduler.stop')) }
  const windows = { showClient: vi.fn(() => events.push('windows.showClient')), showMenuBar: vi.fn(), hideMenuBar: vi.fn(), toggleMenuBar: vi.fn(), broadcast: vi.fn(), dispose: vi.fn(() => events.push('windows.dispose')) }
  const tray = { create: vi.fn(() => events.push('tray.create')), dispose: vi.fn(() => events.push('tray.dispose')) }
  const disposeIpc = vi.fn(() => events.push('ipc.dispose'))
  let capturedToday: TodayService | undefined
  const dependencies: Partial<ApplicationDependencies> = {
    databasePath: join(directory, 'application.sqlite'),
    sources: [],
    createWindowController: () => windows,
    createTrayController: () => tray,
    createRefreshCoordinator: () => coordinator,
    createRefreshScheduler: () => scheduler,
    createTodayService: (dependencies) => {
      const service = new TodayService(dependencies)
      capturedToday = service
      return service
    },
    registerIpc: () => disposeIpc,
    ...overrides
  }
  return { dependencies, events, refresh, scheduler, windows, tray, disposeIpc, getToday: () => capturedToday }
}

describe('createApplication composition', () => {
  it('retains a no-argument production entry point', () => {
    expect(createApplication).toBeTypeOf('function')
    expect(() => createApplication).not.toThrow()
  })

  it('opens the injected database path and registers injected sources', () => {
    const source = { providerId: 'claude-code', detect: vi.fn(), scan: vi.fn() } as unknown as SessionSource
    const opened: string[] = []
    const base = harness({ sources: [source] })
    const application = createApplication({
      ...base.dependencies,
      openDatabase: (path) => {
        opened.push(path)
        return openDatabase(path)
      },
      createRefreshCoordinator: (dependencies) => {
        expect(dependencies.registry.enabled({ 'claude-code': true, codex: false, hermes: false })).toEqual([source])
        return base.dependencies.createRefreshCoordinator!(dependencies)
      }
    })
    expect(opened).toEqual([base.dependencies.databasePath])
    application.dispose()
  })

  it('starts each UI boundary once, schedules once, and starts one refresh', () => {
    const h = harness()
    const application = createApplication(h.dependencies)
    application.start()
    application.start()
    expect(h.events.slice(0, 3)).toEqual(['tray.create', 'windows.showClient', 'scheduler.start'])
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(h.getToday()).toBeDefined()
    application.dispose()
  })

  it('disposes in order and remains idempotent', () => {
    const h = harness()
    const application = createApplication(h.dependencies)
    application.dispose()
    application.dispose()
    expect(h.events).toEqual(['scheduler.stop', 'ipc.dispose', 'tray.dispose', 'windows.dispose'])
    expect(h.disposeIpc).toHaveBeenCalledTimes(1)
  })
})
