import { ipcMain } from 'electron'
import {
  IPC_CHANNELS,
  type AppSettings,
  type RefreshReport,
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

export function registerIpc(services: IpcServices): () => void {
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
    validatedHandler(updateSettingsInputSchema, (input) =>
      services.updateSettings(input)
    )
  )

  const requestChannels = [
    IPC_CHANNELS.getToday,
    IPC_CHANNELS.refreshNow,
    IPC_CHANNELS.getSettings,
    IPC_CHANNELS.updateSettings
  ] as const

  return () => {
    for (const channel of requestChannels) ipcMain.removeHandler(channel)
  }
}
