import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type AppSettings,
  type RefreshReport,
  type RefreshState,
  type RendererApi,
  type TodayViewModel
} from '../shared/api'
import type { Result } from '../shared/result'
import type {
  GetTodayInput,
  UpdateSettingsInput
} from '../shared/schemas'
import type { AppError } from '../shared/api'

const api: RendererApi = Object.freeze({
  getToday: (
    input: GetTodayInput
  ): Promise<Result<TodayViewModel, AppError>> =>
    ipcRenderer.invoke(IPC_CHANNELS.getToday, input),
  refreshNow: (): Promise<Result<RefreshReport, AppError>> =>
    ipcRenderer.invoke(IPC_CHANNELS.refreshNow, undefined),
  getSettings: (): Promise<Result<AppSettings, AppError>> =>
    ipcRenderer.invoke(IPC_CHANNELS.getSettings, undefined),
  updateSettings: (
    input: UpdateSettingsInput
  ): Promise<Result<AppSettings, AppError>> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateSettings, input),
  openClient: (): Promise<Result<void, AppError>> =>
    ipcRenderer.invoke(IPC_CHANNELS.openClient, undefined),
  onRefreshState: (listener: (state: RefreshState) => void): (() => void) => {
    const handler = (_event: unknown, state: RefreshState): void => listener(state)
    ipcRenderer.on(IPC_CHANNELS.refreshState, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.refreshState, handler)
  }
})

contextBridge.exposeInMainWorld('tokenActivityShow', api)
