import { PROVIDER_IDS, type DailyMetrics, type NormalizedSession } from '../../shared/domain'

function localDate(isoTimestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(isoTimestamp))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values['year']}-${values['month']}-${values['day']}`
}

function sumWhenComplete(
  sessions: readonly NormalizedSession[],
  metric: 'interactionCount' | 'tokenUsage' | 'activeDurationSeconds'
): number | null {
  if (sessions.some((session) => session[metric] === null)) return null
  return sessions.reduce((sum, session) => sum + (session[metric] ?? 0), 0)
}

export function aggregateDay(
  sessions: readonly NormalizedSession[],
  date: string,
  timeZone: string
): DailyMetrics[] {
  return PROVIDER_IDS.flatMap((providerId) => {
    const matching = sessions.filter(
      (session) =>
        session.providerId === providerId &&
        localDate(session.startedAt, timeZone) === date
    )
    if (matching.length === 0) return []

    const interactionCount = sumWhenComplete(matching, 'interactionCount')
    const tokenUsage = sumWhenComplete(matching, 'tokenUsage')
    const activeDurationSeconds = sumWhenComplete(
      matching,
      'activeDurationSeconds'
    )

    return [{
      date,
      providerId,
      sessionCount: matching.length,
      interactionCount,
      tokenUsage,
      activeDurationSeconds,
      capabilities: {
        interactions: interactionCount !== null,
        tokens: tokenUsage !== null,
        activeDuration: activeDurationSeconds !== null,
        model: matching.every((session) => session.model !== null),
        trustworthyQuota: false
      }
    }]
  })
}
