import { ipcMain } from 'electron'
import {
  IPC_CHANNELS,
  type AppSettings,
  type RefreshReport,
  type RefreshState,
  type TodayViewModel
} from '../../shared/api'
import { err, ok, type Result } from '../../shared/result'
import {
  getTodayInputSchema,
  refreshNowInputSchema,
  updateSettingsInputSchema,
  type GetTodayInput,
  type UpdateSettingsInput
} from '../../shared/schemas'
import type { AppError } from '../../shared/api'
import type { ZodType } from 'zod'

export interface IpcServices {
  getToday(input: GetTodayInput): Promise<TodayViewModel>
  refreshNow(): Promise<RefreshReport>
  getSettings(): Promise<AppSettings>
  updateSettings(input: UpdateSettingsInput): Promise<AppSettings>
}

export interface IpcRegistrationOptions {
  broadcastRefreshState?: (state: RefreshState) => void
  subscribeRefreshState?: (
    listener: (state: RefreshState) => void
  ) => () => void
  rescheduleRefresh?: (intervalMinutes: number) => void
}

const invalidInput: AppError = {
  code: 'INVALID_INPUT',
  message: 'Invalid IPC input'
}

function internalError(error: unknown): AppError {
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Unexpected IPC failure'
  }
}

function validatedHandler<Input, Output>(
  schema: ZodType<Input>,
  service: (input: Input) => Promise<Output>
): (_event: unknown, input: unknown) => Promise<Result<Output, AppError>> {
  return async (_event, input) => {
    const parsed = schema.safeParse(input)
    if (!parsed.success) return err(invalidInput)

    try {
      return ok(await service(parsed.data))
    } catch (error) {
      return err(internalError(error))
    }
  }
}

export function registerIpc(
  services: IpcServices,
  options: IpcRegistrationOptions = {}
): () => void {
  const unsubscribeRefreshState = options.subscribeRefreshState?.((state) =>
    options.broadcastRefreshState?.(state)
  )
  ipcMain.handle(
    IPC_CHANNELS.getToday,
    validatedHandler(getTodayInputSchema, (input) => services.getToday(input))
  )
  ipcMain.handle(
    IPC_CHANNELS.refreshNow,
    validatedHandler(refreshNowInputSchema, () => services.refreshNow())
  )
  ipcMain.handle(
    IPC_CHANNELS.getSettings,
    validatedHandler(refreshNowInputSchema, () => services.getSettings())
  )
  ipcMain.handle(
    IPC_CHANNELS.updateSettings,
    validatedHandler(updateSettingsInputSchema, async (input) => {
      const settings = await services.updateSettings(input)
      options.rescheduleRefresh?.(settings.refreshIntervalMinutes)
      return settings
    })
  )

  const requestChannels = [
    IPC_CHANNELS.getToday,
    IPC_CHANNELS.refreshNow,
    IPC_CHANNELS.getSettings,
    IPC_CHANNELS.updateSettings
  ] as const

  return () => {
    unsubscribeRefreshState?.()
    for (const channel of requestChannels) ipcMain.removeHandler(channel)
  }
}
