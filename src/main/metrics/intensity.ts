export interface IntensityDay {
  date: string
  sessionCount: number
  interactionCount: number | null
  tokenUsage: number | null
  activeDurationSeconds: number | null
}

export interface IntensityInput {
  today: IntensityDay
  history: readonly IntensityDay[]
}

export type IntensityMetric =
  | 'interactions'
  | 'sessions'
  | 'tokens'
  | 'activeDuration'

export interface IntensityAssessment {
  status: 'insufficient-data' | 'preliminary' | 'established'
  comparison: 'provisional'
  score: number
  band: 'very-low' | 'low' | 'normal' | 'high' | 'very-high'
  effectiveUseDays: number
  contextDays: number
  availableMetrics: IntensityMetric[]
  explanation: string
}

const METRICS = [
  { name: 'interactions', field: 'interactionCount', weight: 40 },
  { name: 'activeDuration', field: 'activeDurationSeconds', weight: 30 },
  { name: 'sessions', field: 'sessionCount', weight: 20 },
  { name: 'tokens', field: 'tokenUsage', weight: 10 }
] as const

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

function robustZ(value: number, baseline: readonly number[]): number {
  const center = median(baseline)
  const deviation = median(baseline.map((sample) => Math.abs(sample - center)))
  const scale = deviation === 0 ? Math.max(1, Math.abs(center) * 0.1) : deviation * 1.4826
  return Math.max(-3, Math.min(3, (value - center) / scale))
}

export function calculateIntensity(input: IntensityInput): IntensityAssessment {
  const effectiveHistory = input.history.filter((day) => day.sessionCount > 0)
  const effectiveUseDays = effectiveHistory.length
  const shortTermBaseline = effectiveHistory.slice(-7)
  const status = effectiveUseDays < 3
    ? 'insufficient-data'
    : effectiveUseDays < 7
      ? 'preliminary'
      : 'established'

  const available = METRICS.filter((metric) => {
    const todayValue = input.today[metric.field]
    return todayValue !== null && shortTermBaseline.every((day) => day[metric.field] !== null)
  })
  const totalWeight = available.reduce((sum, metric) => sum + metric.weight, 0)
  const weightedZ = totalWeight === 0
    ? 0
    : available.reduce((sum, metric) => {
        const value = input.today[metric.field] ?? 0
        const baseline = shortTermBaseline.map((day) => day[metric.field] ?? 0)
        return sum + robustZ(value, baseline) * (metric.weight / totalWeight)
      }, 0)
  const score = Math.round(Math.max(0, Math.min(100, 50 + weightedZ * 15)))
  const band = score < 20
    ? 'very-low'
    : score < 40
      ? 'low'
      : score <= 60
        ? 'normal'
        : score <= 80
          ? 'high'
          : 'very-high'

  return {
    status,
    comparison: 'provisional',
    score,
    band,
    effectiveUseDays,
    contextDays: input.history.length,
    availableMetrics: available.map((metric) => metric.name),
    explanation:
      status === 'insufficient-data'
        ? '需要至少 3 个有效使用日才能建立初步基线。'
        : '当日尚未结束，当前强度比较为临时结果。'
  }
}
