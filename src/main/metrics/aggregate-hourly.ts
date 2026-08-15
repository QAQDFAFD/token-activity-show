import { PROVIDER_IDS, type HourlyActivity, type NormalizedSession, type ProviderId } from '../../shared/domain'

function localHour(isoTimestamp: string, timeZone: string): number {
  if (!Number.isFinite(Date.parse(isoTimestamp))) return -1
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(isoTimestamp))
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  const hour = Number(values.hour)
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : -1
}

function localDate(isoTimestamp: string, timeZone: string): string {
  if (!Number.isFinite(Date.parse(isoTimestamp))) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(isoTimestamp))
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

const emptyProviderCounts = (): Record<ProviderId, number | null> =>
  Object.fromEntries(PROVIDER_IDS.map((providerId) => [providerId, null])) as Record<ProviderId, number | null>

export function aggregateHourlyActivity(
  sessions: readonly NormalizedSession[],
  date: string,
  timeZone: string
): HourlyActivity[] {
  const buckets: HourlyActivity[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    totalInteractions: null,
    byProvider: emptyProviderCounts()
  }))

  for (const providerId of PROVIDER_IDS) {
    const matching = sessions.filter((session) => session.providerId === providerId)
    if (matching.length === 0) continue

    for (const session of matching) {
      for (const at of session.interactionEvents) {
        if (!Number.isFinite(Date.parse(at))) continue
        if (localDate(at, timeZone) !== date) continue
        const hour = localHour(at, timeZone)
        if (hour < 0) continue
        const bucket = buckets[hour]
        if (bucket === undefined) continue
        const counts = bucket.byProvider
        counts[providerId] = (counts[providerId] ?? 0) + 1
      }
    }

    for (const bucket of buckets) {
      if (bucket.byProvider[providerId] === null) bucket.byProvider[providerId] = 0
    }
  }

  for (const bucket of buckets) {
    const counts = PROVIDER_IDS.flatMap((providerId) => {
      const value = bucket.byProvider[providerId]
      return value === null ? [] : [value]
    })
    bucket.totalInteractions = counts.length > 0
      ? counts.reduce((sum, value) => sum + value, 0)
      : null
  }

  return buckets
}
