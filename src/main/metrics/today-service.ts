import type { TodayViewModel } from '../../shared/api'
import type { DailyMetrics, NormalizedSession } from '../../shared/domain'
import type { GetTodayInput } from '../../shared/schemas'
import type { MetricsRepository } from '../db/metrics-repository'
import type { SessionRepository } from '../db/session-repository'
import { aggregateDay } from './aggregate-day'
import { calculateIntensity, type IntensityDay } from './intensity'

export interface TodayServiceDependencies {
  sessions: Pick<SessionRepository, 'listByLocalDate'>
  metrics: Pick<MetricsRepository, 'upsertMany'>
  now?: () => Date
}

function previousDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() - days)
  return value.toISOString().slice(0, 10)
}

function nullableSum(
  records: readonly DailyMetrics[],
  field: 'interactionCount' | 'tokenUsage' | 'activeDurationSeconds'
): number | null {
  if (records.length === 0 || records.some((record) => record[field] === null)) {
    return null
  }
  return records.reduce((sum, record) => sum + (record[field] ?? 0), 0)
}

function overallDay(date: string, records: readonly DailyMetrics[]): IntensityDay {
  return {
    date,
    sessionCount: records.reduce((sum, record) => sum + record.sessionCount, 0),
    interactionCount: nullableSum(records, 'interactionCount'),
    tokenUsage: nullableSum(records, 'tokenUsage'),
    activeDurationSeconds: nullableSum(records, 'activeDurationSeconds')
  }
}

export class TodayService {
  private readonly now: () => Date

  constructor(private readonly dependencies: TodayServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date())
  }

  async get(input: GetTodayInput): Promise<TodayViewModel> {
    const todaySessions = this.dependencies.sessions.listByLocalDate(
      input.localDate,
      input.timeZone
    )
    const providerMetrics = aggregateDay(
      todaySessions,
      input.localDate,
      input.timeZone
    )
    this.dependencies.metrics.upsertMany(providerMetrics)

    const today = overallDay(input.localDate, providerMetrics)
    const history = Array.from({ length: 30 }, (_, index) => {
      const date = previousDate(input.localDate, 30 - index)
      const sessions = this.dependencies.sessions.listByLocalDate(
        date,
        input.timeZone
      )
      const historical = overallDay(
        date,
        aggregateDay(sessions, date, input.timeZone)
      )
      return {
        ...historical,
        interactionCount:
          historical.sessionCount === 0 && today.interactionCount !== null
            ? 0
            : historical.interactionCount,
        tokenUsage:
          historical.sessionCount === 0 && today.tokenUsage !== null
            ? 0
            : historical.tokenUsage,
        activeDurationSeconds:
          historical.sessionCount === 0 && today.activeDurationSeconds !== null
            ? 0
            : historical.activeDurationSeconds
      }
    })
    const intensity = calculateIntensity({ today, history })

    return {
      summary: null,
      localDate: input.localDate,
      timeZone: input.timeZone,
      coveredAt: this.now().toISOString(),
      refreshState: { status: 'idle' },
      overall: {
        sessionCount: today.sessionCount,
        interactionCount: today.interactionCount,
        tokenUsage: today.tokenUsage,
        activeDurationSeconds: today.activeDurationSeconds
      },
      providers: providerMetrics.map((record) => ({
        providerId: record.providerId,
        sessionCount: record.sessionCount,
        interactionCount: record.interactionCount,
        tokenUsage: record.tokenUsage,
        activeDurationSeconds: record.activeDurationSeconds
      })),
      recentSessions: [...todaySessions]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 10),
      intensity: {
        status: intensity.status,
        comparison: intensity.comparison,
        score: intensity.score,
        band: intensity.band,
        explanation: intensity.explanation
      },
      metricAvailability: {
        interactions: providerMetrics.length > 0 && providerMetrics.every((record) => record.capabilities.interactions),
        tokens: providerMetrics.length > 0 && providerMetrics.every((record) => record.capabilities.tokens),
        activeDuration: providerMetrics.length > 0 && providerMetrics.every((record) => record.capabilities.activeDuration)
      },
      precisionExplanation: '缺少事件级时间数据时，会话聚合归属到会话开始的本地日期。'
    }
  }
}
