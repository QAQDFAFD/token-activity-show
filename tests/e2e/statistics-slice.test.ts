/** @vitest-environment jsdom */
import { readFile } from 'node:fs/promises'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApplication } from '../../src/main/application'
import type { IpcServices } from '../../src/main/ipc/register-ipc'
import type { RefreshCoordinatorDependencies } from '../../src/main/refresh/refresh-coordinator'
import { RefreshCoordinator } from '../../src/main/refresh/refresh-coordinator'
import type { RendererApi } from '../../src/shared/api'
import { ok } from '../../src/shared/result'
// The renderer has a separate TS config; Vitest transforms it for this cross-process E2E test.
// @ts-expect-error -- JSX is intentionally configured only in the renderer project.
import { MenuBarApp } from '../../src/renderer/src/MenuBarApp'
import { evidencedSessionSource, RAW_BODY_MUST_NOT_BE_STORED } from '../fixtures/e2e/evidenced-sessions'

declare global {
  interface Window { tokenActivityShow?: RendererApi }
}

const temporaryDirectories: string[] = []

afterEach(() => {
  cleanup()
  delete window.tokenActivityShow
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('statistics slice', () => {
  it('flows evidenced sessions from startup refresh through MenuBarApp without storing bodies', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'token-activity-show-e2e-'))
    temporaryDirectories.push(directory)
    const databasePath = join(directory, 'statistics.sqlite')
    let services: IpcServices | undefined
    let startupRefresh: Promise<unknown> | undefined
    let coordinator: RefreshCoordinator | undefined

    const application = createApplication({
      databasePath,
      sources: [evidencedSessionSource],
      currentTodayInput: () => ({ localDate: '2026-08-02', timeZone: 'UTC' }),
      createWindowController: () => ({
        showClient: vi.fn(), showMenuBar: vi.fn(), hideMenuBar: vi.fn(), toggleMenuBar: vi.fn(), broadcast: vi.fn(), dispose: vi.fn()
      }),
      createTrayController: () => ({ create: vi.fn(), dispose: vi.fn() }),
      createRefreshScheduler: () => ({ start: vi.fn(), reschedule: vi.fn(), stop: vi.fn() }),
      createRefreshCoordinator: (dependencies: RefreshCoordinatorDependencies) => {
        coordinator = new RefreshCoordinator(dependencies)
        const refresh = coordinator.refresh.bind(coordinator)
        coordinator.refresh = ((trigger) => {
          const pending = refresh(trigger)
          if (!startupRefresh) startupRefresh = pending
          return pending
        }) as RefreshCoordinator['refresh']
        return coordinator
      },
      registerIpc: (captured) => { services = captured; return vi.fn() }
    })

    application.start()
    await startupRefresh

    const today = await services!.getToday({ localDate: '2026-08-02', timeZone: 'UTC' })
    expect(today.overall).toMatchObject({ sessionCount: 2, interactionCount: 7 })
    expect(today.providers).toContainEqual(expect.objectContaining({ providerId: 'claude-code', sessionCount: 2, interactionCount: 7 }))

    const rendererApi: RendererApi = {
      getToday: async (input) => ok(await services!.getToday(input)),
      refreshNow: async () => ok(await services!.refreshNow()),
      getSettings: async () => ok(await services!.getSettings()),
      updateSettings: async (input) => ok(await services!.updateSettings(input)),
      openClient: async () => ok(undefined),
      onRefreshState: () => () => undefined
    }
    window.tokenActivityShow = rendererApi
    render(createElement(MenuBarApp))
    expect(await screen.findByText('原生会话')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()

    await expect(coordinator!.refresh('manual')).resolves.toMatchObject({ inserted: 0, updated: 0, unchanged: 2 })
    application.dispose()

    expect((await readFile(databasePath)).includes(Buffer.from(RAW_BODY_MUST_NOT_BE_STORED))).toBe(false)
  })
})
