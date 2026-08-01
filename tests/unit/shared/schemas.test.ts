import { describe, expect, it } from 'vitest'
import {
  getTodayInputSchema,
  refreshNowInputSchema,
  updateSettingsInputSchema
} from '../../../src/shared/schemas'

const enabledSources = {
  'claude-code': true,
  codex: false,
  hermes: true
}

describe('IPC request schemas', () => {
  it('accepts a strict local date and IANA time zone', () => {
    expect(
      getTodayInputSchema.parse({
        localDate: '2026-08-01',
        timeZone: 'America/Los_Angeles'
      })
    ).toEqual({ localDate: '2026-08-01', timeZone: 'America/Los_Angeles' })
  })

  it.each([
    { localDate: '2026-02-30', timeZone: 'UTC' },
    { localDate: '2026-08-01', timeZone: 'Not/A_Time_Zone' },
    { localDate: '2026-08-01', timeZone: 'UTC', extra: true }
  ])('rejects invalid getToday input %#', (input) => {
    expect(getTodayInputSchema.safeParse(input).success).toBe(false)
  })

  it.each([0, 5, 10, 15, 30, 60])('accepts refresh interval %i', (value) => {
    expect(
      updateSettingsInputSchema.parse({
        refreshIntervalMinutes: value,
        enabledSources
      }).refreshIntervalMinutes
    ).toBe(value)
  })

  it.each([1, 20, 120])('rejects unsupported refresh interval %i', (value) => {
    expect(
      updateSettingsInputSchema.safeParse({
        refreshIntervalMinutes: value,
        enabledSources
      }).success
    ).toBe(false)
  })

  it.each([
    {
      refreshIntervalMinutes: 10,
      enabledSources: { ...enabledSources, unknown: true }
    },
    { refreshIntervalMinutes: 10, enabledSources, extra: true }
  ])('rejects invalid settings input %#', (input) => {
    expect(updateSettingsInputSchema.safeParse(input).success).toBe(false)
  })

  it('accepts only undefined for refreshNow', () => {
    expect(refreshNowInputSchema.safeParse(undefined).success).toBe(true)
    expect(refreshNowInputSchema.safeParse({}).success).toBe(false)
  })
})
