import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../../src/shared/api'

const { handlers, handle, removeHandler } = vi.hoisted(() => {
  const registeredHandlers = new Map<
    string,
    (...args: unknown[]) => unknown
  >()
  return {
    handlers: registeredHandlers,
    handle: vi.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        registeredHandlers.set(channel, handler)
      }
    ),
    removeHandler: vi.fn((channel: string) => registeredHandlers.delete(channel))
  }
})

vi.mock('electron', () => ({ ipcMain: { handle, removeHandler } }))

import { registerIpc, type IpcServices } from '../../../src/main/ipc/register-ipc'

describe('registerIpc', () => {
  let services: IpcServices

  beforeEach(() => {
    handlers.clear()
    handle.mockClear()
    removeHandler.mockClear()
    services = {
      getToday: vi.fn(async () => ({ summary: null })),
      refreshNow: vi.fn(async () => ({
        status: 'complete' as const,
        trigger: 'manual' as const,
        providers: 0,
        succeeded: 0,
        failed: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        warnings: 0,
        providerResults: []
      })),
      getSettings: vi.fn(async () => ({
        refreshIntervalMinutes: 10,
        enabledSources: { 'claude-code': true, codex: true, hermes: true }
      })),
      updateSettings: vi.fn(async (input) => input),
      openClient: vi.fn(async () => undefined)
    }
  })

  it('rejects malformed inputs without invoking services', async () => {
    registerIpc(services)

    const invalidCases = [
      [IPC_CHANNELS.getToday, { localDate: 'nope', timeZone: 'UTC' }],
      [IPC_CHANNELS.refreshNow, {}],
      [IPC_CHANNELS.updateSettings, {
        refreshIntervalMinutes: 7,
        enabledSources: { 'claude-code': true, codex: true, hermes: true }
      }]
    ] as const

    for (const [channel, input] of invalidCases) {
      const result = await handlers.get(channel)?.({}, input)
      expect(result).toEqual({
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid IPC input' }
      })
    }

    expect(services.getToday).not.toHaveBeenCalled()
    expect(services.refreshNow).not.toHaveBeenCalled()
    expect(services.updateSettings).not.toHaveBeenCalled()
  })

  it('validates and delegates every request channel', async () => {
    registerIpc(services)
    const today = { localDate: '2026-08-01', timeZone: 'Asia/Shanghai' }
    const settings = {
      refreshIntervalMinutes: 15 as const,
      enabledSources: { 'claude-code': true, codex: false, hermes: true }
    }

    expect(await handlers.get(IPC_CHANNELS.getToday)?.({}, today)).toEqual({
      ok: true,
      value: { summary: null }
    })
    expect(await handlers.get(IPC_CHANNELS.refreshNow)?.({}, undefined)).toEqual({
      ok: true,
      value: expect.objectContaining({ status: 'complete' })
    })
    expect(await handlers.get(IPC_CHANNELS.openClient)?.({}, undefined)).toEqual({
      ok: true,
      value: undefined
    })
    expect(await handlers.get(IPC_CHANNELS.getSettings)?.({}, undefined)).toEqual({
      ok: true,
      value: expect.objectContaining({ refreshIntervalMinutes: 10 })
    })
    expect(await handlers.get(IPC_CHANNELS.updateSettings)?.({}, settings)).toEqual({
      ok: true,
      value: settings
    })
  })

  it('returns serializable expected failures', async () => {
    services.refreshNow = vi.fn(async () => {
      throw new Error('scan failed')
    })
    registerIpc(services)

    expect(await handlers.get(IPC_CHANNELS.refreshNow)?.({}, undefined)).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'scan failed' }
    })
  })

  it('reschedules after settings are persisted and forwards refresh states', async () => {
    const rescheduleRefresh = vi.fn()
    const broadcastRefreshState = vi.fn()
    let refreshListener: ((state: { status: 'scanning' }) => void) | undefined
    const unsubscribe = vi.fn()
    registerIpc(services, {
      rescheduleRefresh,
      broadcastRefreshState,
      subscribeRefreshState: (listener) => {
        refreshListener = listener
        return unsubscribe
      }
    })
    const settings = {
      refreshIntervalMinutes: 15 as const,
      enabledSources: { 'claude-code': true, codex: false, hermes: true }
    }

    await handlers.get(IPC_CHANNELS.updateSettings)?.({}, settings)
    refreshListener?.({ status: 'scanning' })

    expect(rescheduleRefresh).toHaveBeenCalledWith(15)
    expect(broadcastRefreshState).toHaveBeenCalledWith({ status: 'scanning' })
  })

  it('removes every registered handler and state subscription when disposed', () => {
    const unsubscribe = vi.fn()
    const dispose = registerIpc(services, {
      subscribeRefreshState: () => unsubscribe
    })
    dispose()

    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(removeHandler.mock.calls.map(([channel]) => channel)).toEqual([
      IPC_CHANNELS.getToday,
      IPC_CHANNELS.refreshNow,
      IPC_CHANNELS.getSettings,
      IPC_CHANNELS.updateSettings,
      IPC_CHANNELS.openClient
    ])
  })
})
