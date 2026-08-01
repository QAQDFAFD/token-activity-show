import { z } from 'zod'
import { PROVIDER_IDS } from './domain'

const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

function isValidLocalDate(value: string): boolean {
  const match = localDatePattern.exec(value)
  if (match === null) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

const localDateSchema = z.string().refine(isValidLocalDate, 'Invalid local date')
const timeZoneSchema = z.string().refine(isValidTimeZone, 'Invalid IANA time zone')

export const getTodayInputSchema = z
  .object({
    localDate: localDateSchema,
    timeZone: timeZoneSchema
  })
  .strict()

const enabledSourcesSchema = z
  .object(Object.fromEntries(PROVIDER_IDS.map((id) => [id, z.boolean()])))
  .strict()

export const updateSettingsInputSchema = z
  .object({
    refreshIntervalMinutes: z.union([
      z.literal(0),
      z.literal(5),
      z.literal(10),
      z.literal(15),
      z.literal(30),
      z.literal(60)
    ]),
    enabledSources: enabledSourcesSchema
  })
  .strict()

export const refreshNowInputSchema = z.undefined()

export type GetTodayInput = z.infer<typeof getTodayInputSchema>
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>
